import { and, asc, count, eq, inArray, isNull, like, or, sql } from "drizzle-orm";
import { ClientError, NotFoundError } from "../../exceptions/clientError";
import { db, poolConnection } from "../../lib/db";
import { departments, dispositionHistories, dispositions, incomingLetterHistories, incomingLetters, roles, users } from "../../lib/schema";
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
    const [user] = await db.select({ departmentId: users.departmentId }).from(users).where(eq(users.id, userId));
    const targetFilter = or(eq(dispositions.toUserId, userId), ...(role === "pegawai" && user?.departmentId ? [eq(dispositions.toDepartmentId, user.departmentId)] : role === "pegawai" ? [] : [eq(dispositions.targetType, "all")]))!;
    const principalHistory = role === "kepala_sekolah" && filters.tab === "history";
    const visibleToActor = principalHistory
      ? or(eq(dispositions.fromUserId, userId), and(targetFilter, eq(dispositions.statusTindakLanjut, "Selesai")))!
      : targetFilter;
    const conditions = [active, visibleToActor];
    if (filters.tab === "history" && !principalHistory) conditions.push(eq(dispositions.statusTindakLanjut, "Selesai"));
    else if (filters.tab === "active") conditions.push(inArray(dispositions.statusTindakLanjut, ["Belum Diproses", "Diproses"]));
    if (filters.status) conditions.push(eq(dispositions.statusTindakLanjut, filters.status));
    if (filters.prioritas) conditions.push(eq(dispositions.prioritas, filters.prioritas));
    const where = and(...conditions);
    const [total] = await db.select({ total: count() }).from(dispositions).where(where);
    const rows = await db.select({ d: dispositions, l: incomingLetters, sender: users.name })
      .from(dispositions).innerJoin(incomingLetters, eq(dispositions.letterId, incomingLetters.id))
      .innerJoin(users, eq(dispositions.fromUserId, users.id)).where(where)
      .orderBy(asc(dispositions.createdAt)).limit(filters.limit).offset((filters.page - 1) * filters.limit);
    return { data: rows.map(({ d, l, sender }) => ({ id: d.id, nomor_disposisi: d.nomorDisposisi, surat: { id: l.id, nomor_agenda: l.nomorAgenda, nomor_surat: l.nomorSurat, pengirim: l.pengirim, perihal: l.perihal }, pemberi_instruksi: sender, target_type: d.targetType, instruksi: d.instruksi, prioritas: d.prioritas, batas_waktu: d.batasWaktu, status_tindak_lanjut: d.statusTindakLanjut, created_at: d.createdAt })), pagination: { page: filters.page, limit: filters.limit, total_items: Number(total?.total ?? 0), total_pages: Math.ceil(Number(total?.total ?? 0) / filters.limit) } };
  }

  async create(payload: InitialDispositionPayload, actorId: number) {
    const [letter] = await db.select().from(incomingLetters).where(and(eq(incomingLetters.id, payload.letter_id), isNull(incomingLetters.deletedAt)));
    if (!letter) throw new NotFoundError("Incoming letter not found");
    if (!["Menunggu Kepala Sekolah", "Didisposisikan"].includes(letter.status)) throw new ClientError("Letter is not ready for disposition");
    const recipient = payload.target_type === "all" ? "Seluruh pengguna"
      : (await db.select({ name: departments.name }).from(departments).where(and(eq(departments.id, payload.to_department_id!), isNull(departments.deletedAt))))[0]?.name;
    if (!recipient) throw new ClientError("Disposition target not found");
    const isBroadcast = payload.target_type === "all";
    const completedAt = isBroadcast ? new Date() : null;
    const year = new Date().getFullYear();
    const created = await createNumberLock(year, async () => db.transaction(async (tx) => {
      const [maxRow] = await tx.select({ max: sql<number>`MAX(CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(${dispositions.nomorDisposisi}, '/', 1), '-', -1) AS UNSIGNED))` }).from(dispositions).where(like(dispositions.nomorDisposisi, `DSP-%/${year}`));
      const nomor = `DSP-${String(Number(maxRow?.max ?? 0) + 1).padStart(3, "0")}/${year}`;
      const [inserted] = await tx.insert(dispositions).values({ letterId: letter.id, fromUserId: actorId, targetType: payload.target_type, toDepartmentId: payload.to_department_id ?? null, toUserId: null, instruksi: payload.instruksi, catatanTambahan: payload.catatan_tambahan ?? null, prioritas: payload.prioritas, batasWaktu: payload.batas_waktu, nomorDisposisi: nomor, statusTindakLanjut: isBroadcast ? "Selesai" : "Belum Diproses", tanggalSelesai: completedAt });
      await tx.update(incomingLetters).set({ status: isBroadcast ? "Selesai" : "Didisposisikan" }).where(eq(incomingLetters.id, letter.id));
      const dispositionId = Number(inserted.insertId);
      await tx.insert(dispositionHistories).values({ dispositionId, userId: actorId, aktivitas: isBroadcast ? "Disposisi selesai" : "Tugas diberikan", keterangan: `Surat didisposisikan kepada ${recipient}${isBroadcast ? " dan otomatis diselesaikan" : ""}` });
      await tx.insert(incomingLetterHistories).values({ letterId: letter.id, userId: actorId, aktivitas: "Disposisi dibuat", keterangan: `Surat didisposisikan kepada ${recipient}` });
      if (isBroadcast) await tx.insert(incomingLetterHistories).values({ letterId: letter.id, userId: actorId, aktivitas: "Surat selesai", keterangan: "Disposisi ditujukan kepada semua dan otomatis diselesaikan." });
      return { id: Number(inserted.insertId), nomor_disposisi: nomor, status_tindak_lanjut: isBroadcast ? "Selesai" : "Belum Diproses", tanggal_disposisi: new Date().toISOString() };
    }));
    const recipients = payload.target_type === "department" && payload.to_department_id ? (await db.select({ id: users.id }).from(users).innerJoin(roles, eq(users.roleId, roles.id)).where(and(eq(users.departmentId, payload.to_department_id), eq(roles.name, "pegawai"), isNull(users.deletedAt)))).map((u) => u.id) : [];
    await Promise.all(recipients.map((userId) => sendNotification({ userId, title: "Disposisi Baru", message: `Anda menerima disposisi ${created.nomor_disposisi}.`, type: "disposisi", refId: created.id, linkUrl: `/disposisi/${created.id}` }).catch((error) => console.error("Notification write failed", error))));
    return created;
  }

  private async findDisposition(id: number) {
    const [row] = await db.select({ d: dispositions, letter: incomingLetters }).from(dispositions).innerJoin(incomingLetters, eq(dispositions.letterId, incomingLetters.id)).where(and(eq(dispositions.id, id), active));
    if (!row) throw new NotFoundError("Disposition not found");
    return row;
  }

  private async assertRecipient(id: number, actorId: number) {
    const { d } = await this.findDisposition(id);
    const [u] = await db.select({ departmentId: users.departmentId, role: roles.name }).from(users).innerJoin(roles, eq(users.roleId, roles.id)).where(eq(users.id, actorId));
    if (!((d.targetType === "user" && d.toUserId === actorId) || (u?.role === "pegawai" && d.targetType === "department" && !!u.departmentId && d.toDepartmentId === u.departmentId) || d.targetType === "all")) throw new ClientError("You are not a recipient of this disposition", 403);
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
    if (!canAdvanceDisposition(current.statusTindakLanjut, payload.status)) throw new ClientError("Invalid follow-up status transition");
    const [letter] = await db.select().from(incomingLetters).where(eq(incomingLetters.id, current.letterId));
    await db.transaction(async (tx) => {
      await tx.update(dispositions).set({ statusTindakLanjut: payload.status, catatanTindakLanjut: payload.catatan_tindak_lanjut ?? current.catatanTindakLanjut, ...(payload.status === "Selesai" ? { tanggalSelesai: new Date() } : {}) }).where(eq(dispositions.id, id));
      const [actor] = await tx.select({ name: users.name }).from(users).where(eq(users.id, actorId));
      await tx.insert(incomingLetterHistories).values({ letterId: current.letterId, userId: actorId, aktivitas: "Tindak lanjut disposisi diperbarui", keterangan: `Tindak lanjut disposisi diperbarui menjadi: ${payload.status} oleh ${actor?.name ?? "pengguna"}` });
      await tx.insert(dispositionHistories).values({ dispositionId: id, userId: actorId, aktivitas: `Status diubah menjadi ${payload.status}`, keterangan: payload.catatan_tindak_lanjut ?? current.catatanTindakLanjut });
      if (payload.status === "Selesai" && current.parentDispositionId === null) {
        const [openRoots] = await tx.select({ total: count() }).from(dispositions).where(and(eq(dispositions.letterId, current.letterId), isNull(dispositions.parentDispositionId), active, sql`${dispositions.statusTindakLanjut} <> 'Selesai'`, sql`${dispositions.id} <> ${id}`));
        if (Number(openRoots?.total ?? 0) === 0) {
          await tx.update(incomingLetters).set({ status: "Selesai" }).where(eq(incomingLetters.id, current.letterId));
          await tx.insert(incomingLetterHistories).values({ letterId: current.letterId, userId: actorId, aktivitas: "Surat selesai", keterangan: "Seluruh disposisi selesai. Surat diarsipkan." });
        }
      }
    });
    if (payload.status === "Selesai") {
      if (current.parentDispositionId !== null) {
        await sendNotification({ userId: current.fromUserId, title: "Laporan Tugas Selesai", message: `Tugas ${current.nomorDisposisi} telah diselesaikan dan menunggu verifikasi.`, type: "tugas_selesai", refId: id, linkUrl: `/disposisi/${current.parentDispositionId}` }).catch((error) => console.error("Notification write failed", error));
      } else {
        const managers = await db.select({ id: users.id }).from(users).innerJoin(roles, eq(users.roleId, roles.id)).where(and(inArray(roles.name, ["kepala_sekolah", "tu"]), isNull(users.deletedAt)));
        await Promise.all(managers.map((manager) => sendNotification({ userId: manager.id, title: "Seluruh Disposisi Selesai", message: `Seluruh disposisi untuk surat #${current.letterId} telah selesai.`, type: "surat_masuk", refId: current.letterId, linkUrl: `/surat-masuk/${current.letterId}` }).catch((error) => console.error("Notification write failed", error))));
      }
    }
    return { id_disposisi: id, status: payload.status, catatan: payload.catatan_tindak_lanjut ?? current.catatanTindakLanjut, tanggal_selesai: payload.status === "Selesai" ? new Date().toISOString() : null };
  }

  async detail(id: number, actorId: number, role: string) {
    const { d, letter } = await this.findDisposition(id);
    const allowed = role === "admin" || role === "tu" || role === "kepala_sekolah" || d.fromUserId === actorId || d.toUserId === actorId || (d.targetType === "all" && role !== "pegawai") || (role === "pegawai" && await this.userInDepartment(actorId, d.toDepartmentId));
    if (!allowed) throw new ClientError("Forbidden", 403);
    const children = role === "pegawai" ? [] : await db.select({ d: dispositions, name: users.name }).from(dispositions).leftJoin(users, eq(dispositions.toUserId, users.id)).where(and(eq(dispositions.parentDispositionId, id), active)).orderBy(asc(dispositions.id));
    const [sender] = await db.select({ name: users.name }).from(users).where(eq(users.id, d.fromUserId));
    const [department] = d.toDepartmentId ? await db.select({ name: departments.name }).from(departments).where(eq(departments.id, d.toDepartmentId)) : [];
    return { id: d.id, nomor_disposisi: d.nomorDisposisi, surat: { id: letter.id, nomor_agenda: letter.nomorAgenda, nomor_surat: letter.nomorSurat, perihal: letter.perihal, pengirim: letter.pengirim, tanggal_surat: letter.tanggalSurat, file_name: letter.fileName }, pemberi_instruksi: sender?.name, target_type: d.targetType, penerima: d.toUserId ? (await db.select({ name: users.name }).from(users).where(eq(users.id, d.toUserId)))[0]?.name : department?.name ?? "Seluruh pengguna", instruksi: d.instruksi, catatan_tambahan: d.catatanTambahan, prioritas: d.prioritas, batas_waktu: d.batasWaktu, status_tindak_lanjut: d.statusTindakLanjut, catatan_tindak_lanjut: d.catatanTindakLanjut, tanggal_selesai: d.tanggalSelesai, sub_disposisi: children.map(({ d: child, name }) => ({ id: child.id, nomor_disposisi: child.nomorDisposisi, penerima: name ?? "Penerima unit kerja", instruksi: child.instruksi, status_tindak_lanjut: child.statusTindakLanjut, catatan_tindak_lanjut: child.catatanTindakLanjut })) };
  }

  async document(id: number, actorId: number, role: string) {
    const { d, letter } = await this.findDisposition(id);
    const allowed = role === "admin" || role === "tu" || role === "kepala_sekolah" || d.fromUserId === actorId || d.toUserId === actorId || (d.targetType === "all" && role !== "pegawai") || (role === "pegawai" && await this.userInDepartment(actorId, d.toDepartmentId));
    if (!allowed) throw new ClientError("Forbidden", 403);
    return { fileName: letter.fileName, mimeType: getIncomingLetterDocumentMime(letter.filePath), buffer: await readIncomingLetterDocument(letter.filePath) };
  }

  async history(id: number, actorId: number, role: string) {
    await this.detail(id, actorId, role);
    const rows = await db.select({ aktivitas: dispositionHistories.aktivitas, keterangan: dispositionHistories.keterangan, tanggal: dispositionHistories.createdAt, pengguna: users.name })
      .from(dispositionHistories).innerJoin(users, eq(dispositionHistories.userId, users.id)).where(eq(dispositionHistories.dispositionId, id)).orderBy(asc(dispositionHistories.id));
    return rows;
  }

  private async userInDepartment(userId: number, departmentId: number | null) {
    if (!departmentId) return false;
    const [user] = await db.select({ id: users.id }).from(users).where(and(eq(users.id, userId), eq(users.departmentId, departmentId)));
    return !!user;
  }

  async tree(letterId: number) {
    const [letter] = await db.select().from(incomingLetters).where(and(eq(incomingLetters.id, letterId), isNull(incomingLetters.deletedAt)));
    if (!letter) throw new NotFoundError("Incoming letter not found");
    const rows = await db.select({ d: dispositions, sender: users.name }).from(dispositions).innerJoin(users, eq(dispositions.fromUserId, users.id)).where(and(eq(dispositions.letterId, letterId), active)).orderBy(asc(dispositions.id));
    const recipients = await db.select({ d: dispositions, userName: users.name, departmentName: departments.name }).from(dispositions).leftJoin(users, eq(dispositions.toUserId, users.id)).leftJoin(departments, eq(dispositions.toDepartmentId, departments.id)).where(and(eq(dispositions.letterId, letterId), active));
    const recipientMap = new Map(recipients.map((r) => [r.d.id, r.userName ?? r.departmentName ?? "Seluruh pengguna"]));
    const children = new Map<number, typeof rows>();
    for (const row of rows) if (row.d.parentDispositionId !== null) children.set(row.d.parentDispositionId, [...(children.get(row.d.parentDispositionId) ?? []), row]);
    const render = (row: typeof rows[number]): any => ({ id: row.d.id, nomor_disposisi: row.d.nomorDisposisi, dari: row.sender, tujuan: recipientMap.get(row.d.id), instruksi: row.d.instruksi, prioritas: row.d.prioritas, batas_waktu: row.d.batasWaktu, status: row.d.statusTindakLanjut, catatan: row.d.catatanTindakLanjut, anak_disposisi: (children.get(row.d.id) ?? []).map(render) });
    return { letter_id: letter.id, nomor_agenda: letter.nomorAgenda, disposisi_list: rows.filter((r) => r.d.parentDispositionId === null).map(render) };
  }
}

export const dispositionService = new DispositionService();
