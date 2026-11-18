import { and, asc, eq, gte, isNull, like, lt, or, sql } from "drizzle-orm";
import { db } from "../../lib/db";
import { incomingLetters, outgoingLetters } from "../../lib/schema";
import { ClientError, NotFoundError } from "../../exceptions/clientError";

type Filters = { search?: string; jenis?: string; tahun?: number; bulan?: number; status?: string; page: number; limit: number };
function nextMonthStart(year: number, month: number) { return month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`; }
export class ArchiveService {
  async list(filters: Filters) {
    const entries: Array<{ id: number; jenis_arsip: string; nomor_agenda: string; nomor_surat: string | null; perihal: string; pihak_terkait: string; tanggal: string; status: string }> = [];
    if (!filters.jenis || filters.jenis === "surat_masuk") {
      const clauses = [isNull(incomingLetters.deletedAt)];
      if (filters.search) { const q = `%${filters.search}%`; clauses.push(or(like(incomingLetters.nomorSurat, q), like(incomingLetters.nomorAgenda, q), like(incomingLetters.perihal, q), like(incomingLetters.pengirim, q))!); }
      if (filters.status) clauses.push(eq(incomingLetters.status, filters.status));
      if (filters.tahun) { clauses.push(gte(incomingLetters.tanggalDiterima, `${filters.tahun}-${String(filters.bulan ?? 1).padStart(2, "0")}-01`)); clauses.push(lt(incomingLetters.tanggalDiterima, filters.bulan ? nextMonthStart(filters.tahun, filters.bulan) : `${filters.tahun + 1}-01-01`)); }
      else if (filters.bulan) { clauses.push(sql`MONTH(${incomingLetters.tanggalDiterima}) = ${filters.bulan}`); }
      const rows = await db.select().from(incomingLetters).where(and(...clauses)).orderBy(asc(incomingLetters.tanggalDiterima));
      entries.push(...rows.map((x) => ({ id: x.id, jenis_arsip: "surat_masuk", nomor_agenda: x.nomorAgenda, nomor_surat: x.nomorSurat, perihal: x.perihal, pihak_terkait: x.pengirim, tanggal: x.tanggalDiterima, status: x.status })));
    }
    if (!filters.jenis || filters.jenis === "surat_keluar") {
      const clauses = [isNull(outgoingLetters.deletedAt)];
      if (filters.search) { const q = `%${filters.search}%`; clauses.push(or(like(outgoingLetters.nomorSurat, q), like(outgoingLetters.nomorAgenda, q), like(outgoingLetters.perihal, q), like(outgoingLetters.tujuanSurat, q))!); }
      if (filters.status) clauses.push(eq(outgoingLetters.statusSurat, filters.status));
      if (filters.tahun) { clauses.push(gte(outgoingLetters.tanggalSurat, `${filters.tahun}-${String(filters.bulan ?? 1).padStart(2, "0")}-01`)); clauses.push(lt(outgoingLetters.tanggalSurat, filters.bulan ? nextMonthStart(filters.tahun, filters.bulan) : `${filters.tahun + 1}-01-01`)); }
      else if (filters.bulan) clauses.push(sql`MONTH(${outgoingLetters.tanggalSurat}) = ${filters.bulan}`);
      const rows = await db.select().from(outgoingLetters).where(and(...clauses)).orderBy(asc(outgoingLetters.tanggalSurat));
      entries.push(...rows.map((x) => ({ id: x.id, jenis_arsip: "surat_keluar", nomor_agenda: x.nomorAgenda, nomor_surat: x.nomorSurat, perihal: x.perihal, pihak_terkait: x.tujuanSurat, tanggal: x.tanggalSurat, status: x.statusSurat })));
    }
    entries.sort((a, b) => b.tanggal.localeCompare(a.tanggal) || b.id - a.id);
    const total = entries.length;
    return { data: entries.slice((filters.page - 1) * filters.limit, filters.page * filters.limit), pagination: { page: filters.page, limit: filters.limit, total, total_pages: Math.ceil(total / filters.limit) } };
  }
  async detail(kind: string, id: number) {
    if (kind === "surat_masuk") {
      const [row] = await db.select().from(incomingLetters).where(and(eq(incomingLetters.id, id), isNull(incomingLetters.deletedAt)));
      if (row) return { id, jenis_arsip: kind, nomor_agenda: row.nomorAgenda, nomor_surat: row.nomorSurat, tanggal_surat: row.tanggalSurat, tanggal_diterima: row.tanggalDiterima, pihak_terkait: row.pengirim, perihal: row.perihal, jenis_surat: row.jenisSurat, keterangan: row.keterangan, status: row.status, file_name: row.fileName };
    } else if (kind === "surat_keluar") {
      const [row] = await db.select().from(outgoingLetters).where(and(eq(outgoingLetters.id, id), isNull(outgoingLetters.deletedAt)));
      if (row) return { id, jenis_arsip: kind, nomor_agenda: row.nomorAgenda, nomor_surat: row.nomorSurat, tanggal_surat: row.tanggalSurat, tanggal_dikirim: row.tanggalDikirim, pihak_terkait: row.tujuanSurat, perihal: row.perihal, jenis_surat: row.jenisSurat, keterangan: row.keterangan, status: row.statusSurat, file_name: row.fileName };
    } else throw new ClientError("jenis must be surat_masuk or surat_keluar");
    throw new NotFoundError("Archive not found");
  }
  async statistics() {
    const year = new Date().getFullYear();
    const [inTotal] = await db.select({ total: sql<number>`COUNT(*)` }).from(incomingLetters).where(and(isNull(incomingLetters.deletedAt), gte(incomingLetters.tanggalDiterima, `${year}-01-01`), lt(incomingLetters.tanggalDiterima, `${year + 1}-01-01`)));
    const [outTotal] = await db.select({ total: sql<number>`COUNT(*)` }).from(outgoingLetters).where(and(isNull(outgoingLetters.deletedAt), gte(outgoingLetters.tanggalSurat, `${year}-01-01`), lt(outgoingLetters.tanggalSurat, `${year + 1}-01-01`)));
    const statuses = await db.select({ status: incomingLetters.status, total: sql<number>`COUNT(*)` }).from(incomingLetters).where(and(isNull(incomingLetters.deletedAt), gte(incomingLetters.tanggalDiterima, `${year}-01-01`), lt(incomingLetters.tanggalDiterima, `${year + 1}-01-01`))).groupBy(incomingLetters.status);
    const monthlyIn = await db.select({ month: sql<number>`MONTH(${incomingLetters.tanggalDiterima})`, total: sql<number>`COUNT(*)` }).from(incomingLetters).where(and(isNull(incomingLetters.deletedAt), gte(incomingLetters.tanggalDiterima, `${year}-01-01`), lt(incomingLetters.tanggalDiterima, `${year + 1}-01-01`))).groupBy(sql`MONTH(${incomingLetters.tanggalDiterima})`);
    const monthlyOut = await db.select({ month: sql<number>`MONTH(${outgoingLetters.tanggalSurat})`, total: sql<number>`COUNT(*)` }).from(outgoingLetters).where(and(isNull(outgoingLetters.deletedAt), gte(outgoingLetters.tanggalSurat, `${year}-01-01`), lt(outgoingLetters.tanggalSurat, `${year + 1}-01-01`))).groupBy(sql`MONTH(${outgoingLetters.tanggalSurat})`);
    return { tahun: year, total_surat_masuk: Number(inTotal?.total ?? 0), total_surat_keluar: Number(outTotal?.total ?? 0), surat_masuk_per_status: statuses.map((x) => ({ status: x.status, total: Number(x.total) })), rekap_per_bulan: Array.from({ length: 12 }, (_, i) => ({ bulan: i + 1, surat_masuk: Number(monthlyIn.find((x) => Number(x.month) === i + 1)?.total ?? 0), surat_keluar: Number(monthlyOut.find((x) => Number(x.month) === i + 1)?.total ?? 0) })) };
  }
}
export const archiveService = new ArchiveService();
