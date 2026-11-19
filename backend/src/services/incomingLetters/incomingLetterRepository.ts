import { and, asc, count, eq, gte, isNull, like, lt, or, sql } from "drizzle-orm";
import { ClientError } from "../../exceptions/clientError";
import { db } from "../../lib/db";
import { incomingLetterHistories, incomingLetters, users } from "../../lib/schema";
import type { IncomingLetterPayload } from "./validator/schema";

export interface IncomingLetterFilters {
  search?: string;
  status?: string;
  year?: number;
  limit: number;
  offset: number;
}

function buildFilters(filters: IncomingLetterFilters) {
  const conditions = [isNull(incomingLetters.deletedAt)];
  if (filters.search) {
    const term = `%${filters.search}%`;
    conditions.push(
      or(
        like(incomingLetters.perihal, term),
        like(incomingLetters.pengirim, term),
        like(incomingLetters.nomorSurat, term)
      )!
    );
  }
  if (filters.status) conditions.push(like(incomingLetters.status, `%${filters.status}%`));
  if (filters.year) {
    conditions.push(gte(incomingLetters.tanggalDiterima, `${filters.year}-01-01`));
    conditions.push(lt(incomingLetters.tanggalDiterima, `${filters.year + 1}-01-01`));
  }
  return and(...conditions);
}

export class IncomingLetterRepository {
  async getMaxAgendaSequence(year: number) {
    const [row] = await db
      .select({ max: sql<number>`MAX(CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(${incomingLetters.nomorAgenda}, '/', 1), '-', -1) AS UNSIGNED))` })
      .from(incomingLetters)
      .where(like(incomingLetters.nomorAgenda, `SM-%/${year}`));
    return Number(row?.max ?? 0);
  }

  async createLetter(data: IncomingLetterPayload & { nomorAgenda: string; filePath: string; fileName: string; createdBy: number }) {
    return db.transaction(async (tx) => {
      const [inserted] = await tx.insert(incomingLetters).values({
        nomorAgenda: data.nomorAgenda,
        nomorSurat: data.nomor_surat?.trim() || null,
        tanggalSurat: data.tanggal_surat,
        tanggalDiterima: data.tanggal_diterima,
        pengirim: data.pengirim.trim(),
        perihal: data.perihal.trim(),
        jenisSurat: data.jenis_surat.trim(),
        sumberSurat: data.sumber_surat?.trim() || null,
        keterangan: data.keterangan?.trim() || null,
        filePath: data.filePath,
        fileName: data.fileName,
        createdBy: data.createdBy,
      });
      const id = Number(inserted.insertId);
      await tx.insert(incomingLetterHistories).values({
        letterId: id,
        userId: data.createdBy,
        aktivitas: "Surat ditambahkan",
      });
      const [letter] = await tx.select().from(incomingLetters).where(eq(incomingLetters.id, id));
      if (!letter) throw new Error("Failed to retrieve created incoming letter");
      return letter;
    });
  }

  async list(filters: IncomingLetterFilters) {
    const where = buildFilters(filters);
    const [totalRow] = await db.select({ total: count() }).from(incomingLetters).where(where);
    const data = await db
      .select()
      .from(incomingLetters)
      .where(where)
      .orderBy(asc(incomingLetters.tanggalDiterima), asc(incomingLetters.id))
      .limit(filters.limit)
      .offset(filters.offset);
    return { data, total: Number(totalRow?.total ?? 0) };
  }

  async findActiveById(id: number) {
    const [letter] = await db
      .select()
      .from(incomingLetters)
      .where(and(eq(incomingLetters.id, id), isNull(incomingLetters.deletedAt)));
    return letter ?? null;
  }

  async updateLetter(id: number, data: Partial<IncomingLetterPayload> & { filePath?: string; fileName?: string }, userId: number) {
    return db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(incomingLetters)
        .where(and(eq(incomingLetters.id, id), isNull(incomingLetters.deletedAt)));
      if (!current) return null;

      const update: Partial<typeof incomingLetters.$inferInsert> = {};
      if (data.nomor_surat !== undefined) update.nomorSurat = data.nomor_surat.trim() || null;
      if (data.tanggal_surat !== undefined) update.tanggalSurat = data.tanggal_surat;
      if (data.tanggal_diterima !== undefined) update.tanggalDiterima = data.tanggal_diterima;
      if (data.pengirim !== undefined) update.pengirim = data.pengirim.trim();
      if (data.perihal !== undefined) update.perihal = data.perihal.trim();
      if (data.jenis_surat !== undefined) update.jenisSurat = data.jenis_surat.trim();
      if (data.sumber_surat !== undefined) update.sumberSurat = data.sumber_surat.trim() || null;
      if (data.keterangan !== undefined) update.keterangan = data.keterangan.trim() || null;
      if (data.filePath !== undefined) update.filePath = data.filePath;
      if (data.fileName !== undefined) update.fileName = data.fileName;

      await tx.update(incomingLetters).set(update).where(eq(incomingLetters.id, id));
      await tx.insert(incomingLetterHistories).values({ letterId: id, userId, aktivitas: "Surat diubah" });
      const [letter] = await tx.select().from(incomingLetters).where(eq(incomingLetters.id, id));
      if (!letter) throw new Error("Failed to retrieve updated incoming letter");
      return { letter, previousFilePath: data.filePath ? current.filePath : null };
    });
  }

  async softDelete(id: number, userId: number) {
    return db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(incomingLetters)
        .where(and(eq(incomingLetters.id, id), isNull(incomingLetters.deletedAt)));
      if (!current) return false;
      if (!["Draft", "Tercatat"].includes(current.status)) throw new ClientError("Surat yang sudah diteruskan atau diproses tidak dapat dihapus");
      await tx.update(incomingLetters).set({ deletedAt: new Date() }).where(eq(incomingLetters.id, id));
      await tx.insert(incomingLetterHistories).values({ letterId: id, userId, aktivitas: "Surat dihapus" });
      return true;
    });
  }

  async forwardToPrincipal(id: number, userId: number) {
    return db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(incomingLetters)
        .where(and(eq(incomingLetters.id, id), isNull(incomingLetters.deletedAt)));
      if (!current) return null;
      if (!["Draft", "Tercatat"].includes(current.status)) throw new ClientError("Surat ini sudah diteruskan atau diproses dan tidak dapat diteruskan lagi");
      const status = "Menunggu Kepala Sekolah";
      await tx.update(incomingLetters).set({ status }).where(eq(incomingLetters.id, id));
      await tx.insert(incomingLetterHistories).values({
        letterId: id,
        userId,
        aktivitas: "Surat diteruskan",
        keterangan: status,
      });
      return status;
    });
  }

  async listHistory(id: number) {
    return db
      .select({ aktivitas: incomingLetterHistories.aktivitas, keterangan: incomingLetterHistories.keterangan, tanggal: incomingLetterHistories.createdAt, pengguna: users.name })
      .from(incomingLetterHistories)
      .innerJoin(users, eq(incomingLetterHistories.userId, users.id))
      .where(eq(incomingLetterHistories.letterId, id))
      .orderBy(asc(incomingLetterHistories.id));
  }

}

export const incomingLetterRepository = new IncomingLetterRepository();
