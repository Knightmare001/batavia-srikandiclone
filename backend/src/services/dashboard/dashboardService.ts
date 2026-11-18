import { and, count, eq, gte, inArray, isNotNull, isNull, lt, or, desc, ne } from "drizzle-orm";
import { alias } from "drizzle-orm/mysql-core";
import { db } from "../../lib/db";
import { departments, dispositions, incomingLetters, outgoingLetters, roles, systemAuditLogs, users } from "../../lib/schema";

async function total(table: any, where?: any) { const [row] = await db.select({ total: count() }).from(table).where(where); return Number(row?.total ?? 0); }
export class DashboardService {
  async get(userId: number, role: string) {
    const year = new Date().getFullYear();
    const dateRange = and(gte(incomingLetters.tanggalDiterima, `${year}-01-01`), lt(incomingLetters.tanggalDiterima, `${year + 1}-01-01`), isNull(incomingLetters.deletedAt));
    if (role === "admin") {
      const [byRole, recentLogs] = await Promise.all([
        db.select({ role: roles.name, total: count() }).from(users).innerJoin(roles, eq(users.roleId, roles.id)).where(isNull(users.deletedAt)).groupBy(roles.name),
        db.select().from(systemAuditLogs).orderBy(desc(systemAuditLogs.createdAt)).limit(10),
      ]);
      return { total_pengguna_aktif: await total(users, isNull(users.deletedAt)), total_departemen: await total(departments), pengguna_per_role: byRole.map((r) => ({ role: r.role, total: Number(r.total) })), audit_terbaru: recentLogs };
    }
    if (role === "tu") return {
      total_surat_masuk: await total(incomingLetters, isNull(incomingLetters.deletedAt)), total_surat_keluar: await total(outgoingLetters, isNull(outgoingLetters.deletedAt)),
      surat_draft: await total(incomingLetters, and(isNull(incomingLetters.deletedAt), eq(incomingLetters.status, "Draft"))),
      surat_menunggu_kepala_sekolah: await total(incomingLetters, and(isNull(incomingLetters.deletedAt), eq(incomingLetters.status, "Menunggu Kepala Sekolah"))),
    };
    if (role === "kepala_sekolah") {
      const priority = await db.select({ id: incomingLetters.id, nomor_agenda: incomingLetters.nomorAgenda, perihal: incomingLetters.perihal, prioritas: dispositions.prioritas, status: incomingLetters.status }).from(incomingLetters).innerJoin(dispositions, eq(dispositions.letterId, incomingLetters.id)).where(and(isNull(incomingLetters.deletedAt), isNull(dispositions.deletedAt), inArray(dispositions.prioritas, ["Penting", "Segera"]), inArray(dispositions.statusTindakLanjut, ["Belum Diproses", "Diproses"])));
      return { surat_menunggu_disposisi: await total(incomingLetters, and(isNull(incomingLetters.deletedAt), eq(incomingLetters.status, "Menunggu Kepala Sekolah"))), disposisi_berjalan: await total(dispositions, and(isNull(dispositions.deletedAt), inArray(dispositions.statusTindakLanjut, ["Belum Diproses", "Diproses"]))), surat_prioritas_tinggi: priority };
    }
    const [user] = await db.select({ departmentId: users.departmentId }).from(users).where(eq(users.id, userId));
    if (role === "kepala_unit") {
      const recipient = user?.departmentId ? eq(dispositions.toDepartmentId, user.departmentId) : eq(dispositions.toUserId, userId);
      const child = alias(dispositions, "child_dispositions"), parent = alias(dispositions, "parent_dispositions");
      const [awaiting] = await db.select({ total: count() }).from(child).innerJoin(parent, eq(child.parentDispositionId, parent.id)).where(and(isNull(child.deletedAt), isNull(parent.deletedAt), eq(parent.fromUserId, userId), eq(child.statusTindakLanjut, "Selesai"), ne(parent.statusTindakLanjut, "Selesai")));
      return { disposisi_diterima: await total(dispositions, and(isNull(dispositions.deletedAt), recipient)), tugas_diteruskan: await total(dispositions, and(isNull(dispositions.deletedAt), eq(dispositions.fromUserId, userId), isNotNull(dispositions.parentDispositionId))), laporan_menunggu_verifikasi: Number(awaiting?.total ?? 0) };
    }
    const mine = or(eq(dispositions.toUserId, userId), eq(dispositions.targetType, "all"))!;
    const [upcoming] = await db.select({ id: dispositions.id, nomor_disposisi: dispositions.nomorDisposisi, instruksi: dispositions.instruksi, batas_waktu: dispositions.batasWaktu, status: dispositions.statusTindakLanjut }).from(dispositions).where(and(isNull(dispositions.deletedAt), mine, inArray(dispositions.statusTindakLanjut, ["Belum Diproses", "Diproses"]))).orderBy(dispositions.batasWaktu).limit(5);
    return { tugas_aktif: await total(dispositions, and(isNull(dispositions.deletedAt), mine, inArray(dispositions.statusTindakLanjut, ["Belum Diproses", "Diproses"]))), tugas_selesai: await total(dispositions, and(isNull(dispositions.deletedAt), mine, eq(dispositions.statusTindakLanjut, "Selesai"))), tenggat_terdekat: upcoming ?? null };
  }
}
export const dashboardService = new DashboardService();
