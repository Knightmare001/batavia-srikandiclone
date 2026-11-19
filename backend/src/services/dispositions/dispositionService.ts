import { and, asc, count, eq, inArray, isNotNull, isNull, like, or, sql } from "drizzle-orm";
import { ClientError, NotFoundError } from "../../exceptions/clientError";
import { db, poolConnection } from "../../lib/db";
import { departments, dispositionAssignments, dispositionHistories, dispositions, incomingLetterHistories, incomingLetters, roles, users } from "../../lib/schema";
import { getIncomingLetterDocumentMime, readIncomingLetterDocument } from "../incomingLetters/fileStorage";
import { sendNotification } from "../notifications/notificationService";
import type { InitialDispositionPayload } from "./validator/schema";

type PageFilter = { page: number; limit: number; status?: string; prioritas?: string; tab?: "active" | "history" };
const active = isNull(dispositions.deletedAt);

export function canAdvanceDisposition(current: string, next: string) {
  return (current === "Belum Diproses" && next === "Diproses") || (current === "Diproses" && next === "Selesai");
}

async function createNumberLock<T>(year: number, operation: () => Promise<T>): Promise<T> {
  const connection = await poolConnection.getConnection();
  const lockName = `dispositions_${year}`;
  let acquired = false;
  try {
    const [rows] = await connection.query("SELECT GET_LOCK(?, 10) AS acquired", [lockName]);
    acquired = Number((rows as Array<{ acquired: number }>)[0]?.acquired) === 1;
    if (!acquired) throw new ClientError("Could not allocate a disposition number; please retry", 503);
    return await operation();
  } finally {
    if (acquired) await connection.query("SELECT RELEASE_LOCK(?)", [lockName]).catch(() => undefined);
    connection.release();
  }
}

export class DispositionService {
  async inbox(userId: number, role: string, filters: PageFilter) {
    const isEmployee = role === "pegawai";
    const assignedToActor = and(eq(dispositionAssignments.dispositionId, dispositions.id), eq(dispositionAssignments.userId, userId));
    const targetFilter = isEmployee
      ? or(eq(dispositions.toUserId, userId), isNotNull(dispositionAssignments.id))!
      : role === "kepala_sekolah"
        ? or(eq(dispositions.fromUserId, userId), eq(dispositions.toUserId, userId), eq(dispositions.targetType, "all"))!
        : or(eq(dispositions.toUserId, userId), eq(dispositions.targetType, "all"))!;
    const visibleToActor = targetFilter;
    const conditions = [active, visibleToActor];
    const effectiveStatus = sql`COALESCE(${dispositionAssignments.statusTindakLanjut}, ${dispositions.statusTindakLanjut})`;
    if (filters.tab === "history") conditions.push(sql`${effectiveStatus} = 'Selesai'`);
    else if (filters.tab === "active") conditions.push(sql`${effectiveStatus} IN ('Belum Diproses', 'Diproses')`);
    if (filters.status) conditions.push(sql`${effectiveStatus} = ${filters.status}`);
    if (filters.prioritas) conditions.push(eq(dispositions.prioritas, filters.prioritas));
    const where = and(...conditions);
    const [total] = await db.select({ total: count() }).from(dispositions).leftJoin(dispositionAssignments, assignedToActor).where(where);
    const rows = await db.select({ d: dispositions, l: incomingLetters, sender: users.name, assignment: dispositionAssignments })
      .from(dispositions).innerJoin(incomingLetters, eq(dispositions.letterId, incomingLetters.id))
      .innerJoin(users, eq(dispositions.fromUserId, users.id)).leftJoin(dispositionAssignments, assignedToActor).where(where)
      .orderBy(asc(dispositions.createdAt)).limit(filters.limit).offset((filters.page - 1) * filters.limit);
    const ids = [...new Set(rows.map(({ d }) => d.id))];
    const progressRows = ids.length ? await db.select({ dispositionId: dispositionAssignments.dispositionId, total: count(), completed: sql<number>`SUM(CASE WHEN ${dispositionAssignments.statusTindakLanjut} = 'Selesai' THEN 1 ELSE 0 END)`, inProgress: sql<number>`SUM(CASE WHEN ${dispositionAssignments.statusTindakLanjut} = 'Diproses' THEN 1 ELSE 0 END)` }).from(dispositionAssignments).where(inArray(dispositionAssignments.dispositionId, ids)).groupBy(dispositionAssignments.dispositionId) : [];
    const progress = new Map(progressRows.map((row) => [row.dispositionId, { total: Number(row.total), completed: Number(row.completed), inProgress: Number(row.inProgress) }]));
    const assigneeRows = ids.length ? await db.select({ dispositionId: dispositionAssignments.dispositionId, name: users.name, status: dispositionAssignments.statusTindakLanjut, note: dispositionAssignments.catatanTindakLanjut }).from(dispositionAssignments).innerJoin(users, eq(dispositionAssignments.userId, users.id)).where(inArray(dispositionAssignments.dispositionId, ids)).orderBy(asc(users.name)) : [];
    const assignees = new Map<number, typeof assigneeRows>();
    for (const row of assigneeRows) assignees.set(row.dispositionId, [...(assignees.get(row.dispositionId) ?? []), row]);
    return { data: rows.map(({ d, l, sender, assignment }) => {
      const counts = progress.get(d.id) ?? { total: 0, completed: 0, inProgress: 0 };
      return { id: d.id, assignment_id: assignment?.id ?? null, nomor_disposisi: d.nomorDisposisi, surat: { id: l.id, nomor_agenda: l.nomorAgenda, nomor_surat: l.nomorSurat, pengirim: l.pengirim, perihal: l.perihal }, pemberi_instruksi: sender, target_type: d.targetType, instruksi: d.instruksi, prioritas: d.prioritas, batas_waktu: d.batasWaktu, status_tindak_lanjut: assignment?.statusTindakLanjut ?? d.statusTindakLanjut, catatan_tindak_lanjut: assignment ? assignment.catatanTindakLanjut : d.catatanTindakLanjut, penerima_tugas: (assignees.get(d.id) ?? []).map(({ name, status, note }) => ({ nama: name, status, catatan: note })), jumlah_penerima: counts.total, jumlah_selesai: counts.completed, jumlah_diproses: counts.inProgress, jumlah_belum_diproses: counts.total - counts.completed - counts.inProgress, created_at: d.createdAt };
    }), pagination: { page: filters.page, limit: filters.limit, total_items: Number(total?.total ?? 0), total_pages: Math.ceil(Number(total?.total ?? 0) / filters.limit) } };
  }

  async monitor() {
    const rows = await db.select({ d: dispositions, letter: incomingLetters, sender: users.name, department: departments.name })
      .from(dispositions).innerJoin(incomingLetters, eq(dispositions.letterId, incomingLetters.id))
      .innerJoin(users, eq(dispositions.fromUserId, users.id)).leftJoin(departments, eq(dispositions.toDepartmentId, departments.id))
      .where(and(active, isNull(dispositions.parentDispositionId), inArray(dispositions.targetType, ["department", "all"])))
      .orderBy(asc(dispositions.createdAt));
    const ids = rows.map(({ d }) => d.id);
    const stats = ids.length ? await db.select({ dispositionId: dispositionAssignments.dispositionId, total: count(), completed: sql<number>`SUM(CASE WHEN ${dispositionAssignments.statusTindakLanjut} = 'Selesai' THEN 1 ELSE 0 END)`, inProgress: sql<number>`SUM(CASE WHEN ${dispositionAssignments.statusTindakLanjut} = 'Diproses' THEN 1 ELSE 0 END)` }).from(dispositionAssignments).where(inArray(dispositionAssignments.dispositionId, ids)).groupBy(dispositionAssignments.dispositionId) : [];
    const byDisposition = new Map(stats.map((row) => [row.dispositionId, { total: Number(row.total), completed: Number(row.completed), inProgress: Number(row.inProgress) }]));
    return rows.map(({ d, letter, sender, department }) => {
      const progress = byDisposition.get(d.id) ?? { total: 0, completed: 0, inProgress: 0 };
      return { id: d.id, nomor_disposisi: d.nomorDisposisi, surat: { id: letter.id, nomor_agenda: letter.nomorAgenda, perihal: letter.perihal }, pemberi_instruksi: sender, tujuan: d.targetType === "all" ? "Semua Unit Kerja" : department, instruksi: d.instruksi, prioritas: d.prioritas, status_tindak_lanjut: d.statusTindakLanjut, jumlah_penerima: progress.total, jumlah_selesai: progress.completed, jumlah_diproses: progress.inProgress, jumlah_belum_diproses: progress.total - progress.completed - progress.inProgress, created_at: d.createdAt };
    });
  }

  async create(payload: InitialDispositionPayload, actorId: number) {
    const [letter] = await db.select().from(incomingLetters).where(and(eq(incomingLetters.id, payload.letter_id), isNull(incomingLetters.deletedAt)));
    if (!letter) throw new NotFoundError("Incoming letter not found");
    if (!["Menunggu Kepala Sekolah", "Didisposisikan"].includes(letter.status)) throw new ClientError("Letter is not ready for disposition");
    const targetDepartment = payload.target_type === "department"
      ? (await db.select({ id: departments.id, name: departments.name }).from(departments).where(and(eq(departments.id, payload.to_department_id!), isNull(departments.deletedAt))))[0]
      : null;
    if (payload.target_type === "department" && !targetDepartment) throw new ClientError("Disposition Unit Kerja not found");
    const recipientConditions = [eq(roles.name, "pegawai"), isNull(users.deletedAt), isNull(departments.deletedAt)];
    if (targetDepartment) recipientConditions.push(eq(users.departmentId, targetDepartment.id));
    const accountRecipients = await db.select({ id: users.id }).from(users)
      .innerJoin(roles, eq(users.roleId, roles.id)).innerJoin(departments, eq(users.departmentId, departments.id))
      .where(and(...recipientConditions));
    if (!accountRecipients.length) throw new ClientError(payload.target_type === "all" ? "Tidak ada akun Pegawai aktif untuk menerima disposisi" : "Unit Kerja ini belum memiliki akun Pegawai aktif");
    const recipient = targetDepartment?.name ?? "Semua Unit Kerja";
    const year = new Date().getFullYear();
    const created = await createNumberLock(year, async () => db.transaction(async (tx) => {
      const [maxRow] = await tx.select({ max: sql<number>`MAX(CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(${dispositions.nomorDisposisi}, '/', 1), '-', -1) AS UNSIGNED))` }).from(dispositions).where(like(dispositions.nomorDisposisi, `DSP-%/${year}`));
      const nomor = `DSP-${String(Number(maxRow?.max ?? 0) + 1).padStart(3, "0")}/${year}`;
      const [inserted] = await tx.insert(dispositions).values({ letterId: letter.id, fromUserId: actorId, targetType: payload.target_type, toDepartmentId: targetDepartment?.id ?? null, toUserId: null, instruksi: payload.instruksi, catatanTambahan: payload.catatan_tambahan ?? null, prioritas: payload.prioritas, batasWaktu: payload.batas_waktu, nomorDisposisi: nomor, statusTindakLanjut: "Belum Diproses" });
      const dispositionId = Number(inserted.insertId);
      await tx.insert(dispositionAssignments).values(accountRecipients.map((user) => ({ dispositionId, userId: user.id })));
      await tx.update(incomingLetters).set({ status: "Didisposisikan" }).where(eq(incomingLetters.id, letter.id));
      await tx.insert(dispositionHistories).values({ dispositionId, userId: actorId, aktivitas: "Tugas diberikan", keterangan: `Surat didisposisikan kepada ${recipient}; ${accountRecipients.length} akun Pegawai menerima tugas masing-masing` });
      await tx.insert(incomingLetterHistories).values({ letterId: letter.id, userId: actorId, aktivitas: "Disposisi dibuat", keterangan: `Surat didisposisikan kepada ${recipient}` });
      return { id: dispositionId, nomor_disposisi: nomor, status_tindak_lanjut: "Belum Diproses", jumlah_penerima: accountRecipients.length, tanggal_disposisi: new Date().toISOString() };
    }));
    await Promise.all(accountRecipients.map((account) => sendNotification({ userId: account.id, title: "Disposisi Baru", message: `Anda menerima tugas ${created.nomor_disposisi} secara pribadi.`, type: "disposisi", refId: created.id, linkUrl: `/disposisi/${created.id}` }).catch((error) => console.error("Notification write failed", error))));
    return created;
  }

  private async findDisposition(id: number) {
    const [row] = await db.select({ d: dispositions, letter: incomingLetters }).from(dispositions).innerJoin(incomingLetters, eq(dispositions.letterId, incomingLetters.id)).where(and(eq(dispositions.id, id), active));
    if (!row) throw new NotFoundError("Disposition not found");
    return row;
  }

  private async assertRecipient(id: number, actorId: number) {
    const { d } = await this.findDisposition(id);
    const [u] = await db.select({ role: roles.name }).from(users).innerJoin(roles, eq(users.roleId, roles.id)).where(eq(users.id, actorId));
    const [assignment] = u?.role === "pegawai" && (d.targetType === "department" || d.targetType === "all")
      ? await db.select({ id: dispositionAssignments.id }).from(dispositionAssignments).where(and(eq(dispositionAssignments.dispositionId, id), eq(dispositionAssignments.userId, actorId)))
      : [];
    const isDirectRecipient = d.targetType === "user" && d.toUserId === actorId;
    const isAssignedRecipient = !!assignment;
    const managerBroadcastAccess = u?.role !== "pegawai" && d.targetType === "all";
    if (!(isDirectRecipient || isAssignedRecipient || managerBroadcastAccess)) throw new ClientError("You are not a recipient of this disposition", 403);
    return d;
  }

  async forward(id: number, actorId: number, role: string, payload: { to_user_id: number; instruksi: string; batas_waktu: string | null; catatan_tambahan?: string | null }) {
    if (role === "pegawai") throw new ClientError("Pegawai tidak dapat meneruskan disposisi", 403);
    const parent = await this.assertRecipient(id, actorId);
    if (parent.statusTindakLanjut === "Selesai") throw new ClientError("A completed disposition cannot be forwarded");
    const [recipient] = await db.select({ name: users.name, departmentId: users.departmentId }).from(users).innerJoin(roles, eq(users.roleId, roles.id)).innerJoin(departments, eq(users.departmentId, departments.id)).where(and(eq(users.id, payload.to_user_id), eq(roles.name, "pegawai"), isNull(users.deletedAt), isNull(departments.deletedAt)));
    if (!recipient) throw new ClientError("to_user_id was not found");
    if (parent.targetType === "department" && recipient.departmentId !== parent.toDepartmentId) throw new ClientError("Recipient must belong to the parent disposition department");
    const year = new Date().getFullYear();
    const forwarded = await createNumberLock(year, async () => db.transaction(async (tx) => {
      const [maxRow] = await tx.select({ max: sql<number>`MAX(CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(${dispositions.nomorDisposisi}, '/', 1), '-', -1) AS UNSIGNED))` }).from(dispositions).where(like(dispositions.nomorDisposisi, `DSP-%/${year}`));
      const nomor = `DSP-${String(Number(maxRow?.max ?? 0) + 1).padStart(3, "0")}/${year}`;
      const [inserted] = await tx.insert(dispositions).values({ letterId: parent.letterId, parentDispositionId: id, nomorDisposisi: nomor, fromUserId: actorId, targetType: "user", toUserId: payload.to_user_id, instruksi: payload.instruksi, catatanTambahan: payload.catatan_tambahan ?? null, batasWaktu: payload.batas_waktu });
      await tx.insert(dispositionHistories).values({ dispositionId: Number(inserted.insertId), userId: actorId, aktivitas: "Tugas diteruskan", keterangan: `Tugas diberikan kepada ${recipient.name}` });
      const [actor] = await tx.select({ name: users.name }).from(users).where(eq(users.id, actorId));
      await tx.insert(incomingLetterHistories).values({ letterId: parent.letterId, userId: actorId, aktivitas: "Disposisi diteruskan", keterangan: `Tugas disposisi diteruskan oleh ${actor?.name ?? "pengguna"} kepada ${recipient.name}` });
      return { id: Number(inserted.insertId), nomor_disposisi: nomor };
    }));
    await sendNotification({ userId: payload.to_user_id, title: "Tugas Disposisi Baru", message: `Anda menerima tugas ${forwarded.nomor_disposisi}.`, type: "disposisi", refId: forwarded.id, linkUrl: `/disposisi/${forwarded.id}` }).catch((error) => console.error("Notification write failed", error));
    return forwarded;
  }

  async updateFollowUp(id: number, actorId: number, role: string, payload: { status: "Belum Diproses" | "Diproses" | "Selesai"; catatan_tindak_lanjut?: string | null }) {
    const current = await this.assertRecipient(id, actorId);
    const [assignment] = role === "pegawai" && (current.targetType === "department" || current.targetType === "all")
      ? await db.select().from(dispositionAssignments).where(and(eq(dispositionAssignments.dispositionId, id), eq(dispositionAssignments.userId, actorId)))
      : [];
    if ((current.targetType === "department" || current.targetType === "all") && !assignment) throw new ClientError("Only assigned Pegawai can update an individual task", 403);
    const ownStatus = assignment?.statusTindakLanjut ?? current.statusTindakLanjut;
    const ownNote = assignment ? assignment.catatanTindakLanjut : current.catatanTindakLanjut;
    if (!canAdvanceDisposition(ownStatus, payload.status)) throw new ClientError("Invalid follow-up status transition");
    const [actor] = await db.select({ name: users.name }).from(users).where(eq(users.id, actorId));
    let progress = { total: 0, completed: 0, inProgress: 0, pending: 0 };
    let aggregateStatus = payload.status;
    await db.transaction(async (tx) => {
      if (assignment) await tx.execute(sql`SELECT ${dispositions.id} FROM ${dispositions} WHERE ${dispositions.id} = ${id} FOR UPDATE`);
      if (assignment) {
        await tx.update(dispositionAssignments).set({ statusTindakLanjut: payload.status, catatanTindakLanjut: payload.catatan_tindak_lanjut ?? ownNote, ...(payload.status === "Selesai" ? { tanggalSelesai: new Date() } : {}) }).where(eq(dispositionAssignments.id, assignment.id));
        const rows = await tx.select({ status: dispositionAssignments.statusTindakLanjut }).from(dispositionAssignments).where(eq(dispositionAssignments.dispositionId, id));
        progress = {
          total: rows.length,
          completed: rows.filter((row) => row.status === "Selesai").length,
          inProgress: rows.filter((row) => row.status === "Diproses").length,
          pending: rows.filter((row) => row.status === "Belum Diproses").length,
        };
        aggregateStatus = progress.completed === progress.total ? "Selesai" : progress.completed + progress.inProgress > 0 ? "Diproses" : "Belum Diproses";
        await tx.update(dispositions).set({ statusTindakLanjut: aggregateStatus, catatanTindakLanjut: progress.pending === 0 ? null : `${progress.pending} akun belum diproses`, tanggalSelesai: aggregateStatus === "Selesai" ? new Date() : null }).where(eq(dispositions.id, id));
      } else {
        await tx.update(dispositions).set({ statusTindakLanjut: payload.status, catatanTindakLanjut: payload.catatan_tindak_lanjut ?? ownNote, ...(payload.status === "Selesai" ? { tanggalSelesai: new Date() } : {}) }).where(eq(dispositions.id, id));
      }
      const progressText = assignment ? ` (${progress.completed}/${progress.total} selesai, ${progress.pending} belum diproses)` : "";
      await tx.insert(incomingLetterHistories).values({ letterId: current.letterId, userId: actorId, aktivitas: "Tindak lanjut disposisi diperbarui", keterangan: `Tindak lanjut diperbarui menjadi ${payload.status} oleh ${actor?.name ?? "pengguna"}${progressText}` });
      await tx.insert(dispositionHistories).values({ dispositionId: id, userId: actorId, aktivitas: `Status diubah menjadi ${payload.status}`, keterangan: payload.catatan_tindak_lanjut ?? ownNote });
      const groupIsComplete = assignment ? aggregateStatus === "Selesai" : payload.status === "Selesai" && current.parentDispositionId === null;
      if (groupIsComplete && current.parentDispositionId === null) {
        await tx.execute(sql`SELECT ${incomingLetters.id} FROM ${incomingLetters} WHERE ${incomingLetters.id} = ${current.letterId} FOR UPDATE`);
        const [openRoots] = await tx.select({ total: count() }).from(dispositions).where(and(eq(dispositions.letterId, current.letterId), isNull(dispositions.parentDispositionId), active, sql`${dispositions.statusTindakLanjut} <> 'Selesai'`, sql`${dispositions.id} <> ${id}`));
        if (Number(openRoots?.total ?? 0) === 0) {
          await tx.update(incomingLetters).set({ status: "Selesai" }).where(eq(incomingLetters.id, current.letterId));
          await tx.insert(incomingLetterHistories).values({ letterId: current.letterId, userId: actorId, aktivitas: "Surat selesai", keterangan: "Seluruh tugas disposisi dan penerimanya telah selesai." });
        }
      }
    });
    if (assignment) {
      const message = `${progress.completed} dari ${progress.total} akun selesai; ${progress.pending} belum diproses dan ${progress.inProgress} sedang dikerjakan.`;
      await sendNotification({ userId: current.fromUserId, title: "Progres Disposisi Diperbarui", message, type: "tugas_selesai", refId: id, linkUrl: "/disposisi/pantau" }).catch((error) => console.error("Notification write failed", error));
      if (aggregateStatus === "Selesai") {
        const managers = await db.select({ id: users.id }).from(users).innerJoin(roles, eq(users.roleId, roles.id)).where(and(inArray(roles.name, ["admin", "tu", "kepala_sekolah"]), isNull(users.deletedAt)));
        await Promise.all(managers.map((manager) => sendNotification({ userId: manager.id, title: "Semua Tugas Disposisi Selesai", message: `${progress.total} dari ${progress.total} akun telah menyelesaikan tugas ${current.nomorDisposisi}.`, type: "surat_masuk", refId: id, linkUrl: "/disposisi/pantau" }).catch((error) => console.error("Notification write failed", error))));
      }
    } else if (payload.status === "Selesai" && current.parentDispositionId !== null) {
      await sendNotification({ userId: current.fromUserId, title: "Laporan Tugas Selesai", message: `Tugas ${current.nomorDisposisi} telah diselesaikan dan menunggu verifikasi.`, type: "tugas_selesai", refId: id, linkUrl: `/disposisi/${current.parentDispositionId}` }).catch((error) => console.error("Notification write failed", error));
    }
    return { id_disposisi: id, status: payload.status, status_disposisi: aggregateStatus, catatan: payload.catatan_tindak_lanjut ?? ownNote, tanggal_selesai: payload.status === "Selesai" ? new Date().toISOString() : null, ...progress };
  }

  async detail(id: number, actorId: number, role: string) {
    const { d, letter } = await this.findDisposition(id);
    const [assignment] = role === "pegawai" && (d.targetType === "department" || d.targetType === "all")
      ? await db.select().from(dispositionAssignments).where(and(eq(dispositionAssignments.dispositionId, id), eq(dispositionAssignments.userId, actorId)))
      : [];
    const allowed = role === "admin" || role === "tu" || role === "kepala_sekolah" || d.fromUserId === actorId || d.toUserId === actorId || !!assignment || (d.targetType === "all" && role !== "pegawai");
    if (!allowed) throw new ClientError("Forbidden", 403);
    const children = role === "pegawai" ? [] : await db.select({ d: dispositions, name: users.name }).from(dispositions).leftJoin(users, eq(dispositions.toUserId, users.id)).where(and(eq(dispositions.parentDispositionId, id), active)).orderBy(asc(dispositions.id));
    const assignees = role === "pegawai" ? [] : await db.select({ name: users.name, status: dispositionAssignments.statusTindakLanjut, note: dispositionAssignments.catatanTindakLanjut }).from(dispositionAssignments).innerJoin(users, eq(dispositionAssignments.userId, users.id)).where(eq(dispositionAssignments.dispositionId, id)).orderBy(asc(users.name));
    const [sender] = await db.select({ name: users.name }).from(users).where(eq(users.id, d.fromUserId));
    const [department] = d.toDepartmentId ? await db.select({ name: departments.name }).from(departments).where(eq(departments.id, d.toDepartmentId)) : [];
    const completed = assignees.filter((recipient) => recipient.status === "Selesai").length;
    const inProgress = assignees.filter((recipient) => recipient.status === "Diproses").length;
    const ownStatus = assignment?.statusTindakLanjut ?? d.statusTindakLanjut;
    const ownNote = assignment ? assignment.catatanTindakLanjut : d.catatanTindakLanjut;
    return { id: d.id, nomor_disposisi: d.nomorDisposisi, surat: { id: letter.id, nomor_agenda: letter.nomorAgenda, nomor_surat: letter.nomorSurat, perihal: letter.perihal, pengirim: letter.pengirim, tanggal_surat: letter.tanggalSurat, file_name: letter.fileName }, pemberi_instruksi: sender?.name, target_type: d.targetType, penerima: d.toUserId ? (await db.select({ name: users.name }).from(users).where(eq(users.id, d.toUserId)))[0]?.name : department?.name ?? "Semua Unit Kerja", instruksi: d.instruksi, catatan_tambahan: d.catatanTambahan, prioritas: d.prioritas, batas_waktu: d.batasWaktu, status_tindak_lanjut: ownStatus, catatan_tindak_lanjut: ownNote, tanggal_selesai: assignment?.tanggalSelesai ?? d.tanggalSelesai, jumlah_penerima: assignees.length, jumlah_selesai: completed, jumlah_diproses: inProgress, jumlah_belum_diproses: assignees.length - completed - inProgress, penerima_tugas: assignees.map((recipient) => ({ nama: recipient.name, status: recipient.status, catatan: recipient.note })), sub_disposisi: children.map(({ d: child, name }) => ({ id: child.id, nomor_disposisi: child.nomorDisposisi, penerima: name ?? "Penerima unit kerja", instruksi: child.instruksi, status_tindak_lanjut: child.statusTindakLanjut, catatan_tindak_lanjut: child.catatanTindakLanjut })) };
  }

  async document(id: number, actorId: number, role: string) {
    const { d, letter } = await this.findDisposition(id);
    const [assignment] = role === "pegawai" && (d.targetType === "department" || d.targetType === "all")
      ? await db.select({ id: dispositionAssignments.id }).from(dispositionAssignments).where(and(eq(dispositionAssignments.dispositionId, id), eq(dispositionAssignments.userId, actorId)))
      : [];
    const allowed = role === "admin" || role === "tu" || role === "kepala_sekolah" || d.fromUserId === actorId || d.toUserId === actorId || !!assignment || (d.targetType === "all" && role !== "pegawai");
    if (!allowed) throw new ClientError("Forbidden", 403);
    return { fileName: letter.fileName, mimeType: getIncomingLetterDocumentMime(letter.filePath), buffer: await readIncomingLetterDocument(letter.filePath) };
  }

  async history(id: number, actorId: number, role: string) {
    await this.detail(id, actorId, role);
    const conditions = [eq(dispositionHistories.dispositionId, id)];
    if (role === "pegawai") conditions.push(eq(dispositionHistories.userId, actorId));
    const rows = await db.select({ aktivitas: dispositionHistories.aktivitas, keterangan: dispositionHistories.keterangan, tanggal: dispositionHistories.createdAt, pengguna: users.name })
      .from(dispositionHistories).innerJoin(users, eq(dispositionHistories.userId, users.id)).where(and(...conditions)).orderBy(asc(dispositionHistories.id));
    return rows;
  }

  async tree(letterId: number) {
    const [letter] = await db.select().from(incomingLetters).where(and(eq(incomingLetters.id, letterId), isNull(incomingLetters.deletedAt)));
    if (!letter) throw new NotFoundError("Incoming letter not found");
    const rows = await db.select({ d: dispositions, sender: users.name }).from(dispositions).innerJoin(users, eq(dispositions.fromUserId, users.id)).where(and(eq(dispositions.letterId, letterId), active)).orderBy(asc(dispositions.id));
    const recipients = await db.select({ d: dispositions, userName: users.name, departmentName: departments.name }).from(dispositions).leftJoin(users, eq(dispositions.toUserId, users.id)).leftJoin(departments, eq(dispositions.toDepartmentId, departments.id)).where(and(eq(dispositions.letterId, letterId), active));
    const recipientMap = new Map(recipients.map((r) => [r.d.id, r.userName ?? r.departmentName ?? "Seluruh pengguna"]));
    const assignmentRows = await db.select({ dispositionId: dispositionAssignments.dispositionId, name: users.name, status: dispositionAssignments.statusTindakLanjut, note: dispositionAssignments.catatanTindakLanjut }).from(dispositionAssignments).innerJoin(users, eq(dispositionAssignments.userId, users.id)).where(inArray(dispositionAssignments.dispositionId, rows.map((row) => row.d.id)));
    const assignmentMap = new Map<number, typeof assignmentRows>();
    for (const row of assignmentRows) assignmentMap.set(row.dispositionId, [...(assignmentMap.get(row.dispositionId) ?? []), row]);
    const children = new Map<number, typeof rows>();
    for (const row of rows) if (row.d.parentDispositionId !== null) children.set(row.d.parentDispositionId, [...(children.get(row.d.parentDispositionId) ?? []), row]);
    const render = (row: typeof rows[number]): any => ({ id: row.d.id, nomor_disposisi: row.d.nomorDisposisi, dari: row.sender, tujuan: recipientMap.get(row.d.id), instruksi: row.d.instruksi, prioritas: row.d.prioritas, batas_waktu: row.d.batasWaktu, status: row.d.statusTindakLanjut, catatan: row.d.catatanTindakLanjut, penerima_tugas: (assignmentMap.get(row.d.id) ?? []).map((assignment) => ({ nama: assignment.name, status: assignment.status, catatan: assignment.note })), anak_disposisi: (children.get(row.d.id) ?? []).map(render) });
    return { letter_id: letter.id, nomor_agenda: letter.nomorAgenda, disposisi_list: rows.filter((r) => r.d.parentDispositionId === null).map(render) };
  }
}

export const dispositionService = new DispositionService();
