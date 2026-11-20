import {
  and,
  asc,
  count,
  eq,
  gte,
  isNull,
  like,
  lt,
  or,
  sql,
} from "drizzle-orm";
import { db } from "../../lib/db";
import {
  outgoingLetterHistories,
  outgoingLetters,
  users,
} from "../../lib/schema";
import type { OutgoingLetterPayload } from "./validator/schema";

export class OutgoingLetterRepository {
  async nextSequence(year: number) {
    const [row] = await db
      .select({
        max: sql<number>`MAX(CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(${outgoingLetters.nomorAgenda}, '/', 1), '-', -1) AS UNSIGNED))`,
      })
      .from(outgoingLetters)
      .where(like(outgoingLetters.nomorAgenda, `SK-%/${year}`));
    return Number(row?.max ?? 0) + 1;
  }

  async create(
    data: OutgoingLetterPayload & {
      nomorAgenda: string;
      filePath: string;
      fileName: string;
      createdBy: number;
    },
  ) {
    return db.transaction(async (tx) => {
      const [inserted] = await tx.insert(outgoingLetters).values({
        nomorAgenda: data.nomorAgenda,
        nomorSurat: data.nomor_surat.trim(),
        tanggalSurat: data.tanggal_surat,
        tanggalDikirim: data.tanggal_dikirim,
        pembuatSurat: data.pembuat_surat.trim(),
        tujuanSurat: data.tujuan_surat.trim(),
        perihal: data.perihal.trim(),
        jenisSurat: data.jenis_surat.trim(),
        filePath: data.filePath,
        fileName: data.fileName,
        keterangan: data.keterangan?.trim() || null,
        createdBy: data.createdBy,
      });
      const id = Number(inserted.insertId);
      await tx
        .insert(outgoingLetterHistories)
        .values({
          letterId: id,
          userId: data.createdBy,
          aktivitas: "Surat keluar dicatat",
          keterangan: "Pencatatan awal surat keluar",
        });
      return { id, nomorAgenda: data.nomorAgenda };
    });
  }

  async list(filters: {
    search?: string;
    tahun?: number;
    jenis?: string;
    limit: number;
    offset: number;
  }) {
    const conditions = [isNull(outgoingLetters.deletedAt)];
    if (filters.search) {
      const term = `%${filters.search}%`;
      conditions.push(
        or(
          like(outgoingLetters.perihal, term),
          like(outgoingLetters.tujuanSurat, term),
          like(outgoingLetters.pembuatSurat, term),
          like(outgoingLetters.nomorSurat, term),
        )!,
      );
    }
    if (filters.jenis)
      conditions.push(eq(outgoingLetters.jenisSurat, filters.jenis));
    if (filters.tahun) {
      conditions.push(
        gte(outgoingLetters.tanggalSurat, `${filters.tahun}-01-01`),
      );
      conditions.push(
        lt(outgoingLetters.tanggalSurat, `${filters.tahun + 1}-01-01`),
      );
    }
    const where = and(...conditions);
    const [total] = await db
      .select({ total: count() })
      .from(outgoingLetters)
      .where(where);
    const rows = await db
      .select()
      .from(outgoingLetters)
      .where(where)
      .orderBy(asc(outgoingLetters.tanggalSurat), asc(outgoingLetters.id))
      .limit(filters.limit)
      .offset(filters.offset);
    return { data: rows, total: Number(total?.total ?? 0) };
  }

  async findActive(id: number) {
    const [letter] = await db
      .select()
      .from(outgoingLetters)
      .where(
        and(eq(outgoingLetters.id, id), isNull(outgoingLetters.deletedAt)),
      );
    return letter ?? null;
  }

  async update(
    id: number,
    data: Partial<OutgoingLetterPayload> & {
      filePath?: string;
      fileName?: string;
    },
    userId: number,
  ) {
    return db.transaction(async (tx) => {
      const [current] = await tx
        .select()
        .from(outgoingLetters)
        .where(
          and(eq(outgoingLetters.id, id), isNull(outgoingLetters.deletedAt)),
        );
      if (!current) return null;
      const update: Partial<typeof outgoingLetters.$inferInsert> = {};
      if (data.nomor_surat !== undefined)
        update.nomorSurat = data.nomor_surat.trim();
      if (data.tanggal_surat !== undefined)
        update.tanggalSurat = data.tanggal_surat;
      if (data.tanggal_dikirim !== undefined)
        update.tanggalDikirim = data.tanggal_dikirim;
      if (data.pembuat_surat !== undefined)
        update.pembuatSurat = data.pembuat_surat.trim();
      if (data.tujuan_surat !== undefined)
        update.tujuanSurat = data.tujuan_surat.trim();
      if (data.perihal !== undefined) update.perihal = data.perihal.trim();
      if (data.jenis_surat !== undefined)
        update.jenisSurat = data.jenis_surat.trim();
      if (data.keterangan !== undefined)
        update.keterangan = data.keterangan?.trim() || null;
      if (data.filePath !== undefined) update.filePath = data.filePath;
      if (data.fileName !== undefined) update.fileName = data.fileName;
      await tx
        .update(outgoingLetters)
        .set(update)
        .where(eq(outgoingLetters.id, id));
      await tx
        .insert(outgoingLetterHistories)
        .values({
          letterId: id,
          userId,
          aktivitas: "Informasi surat keluar diperbarui",
          keterangan: "Metadata surat keluar diperbarui",
        });
      return {
        previousFilePath: data.filePath ? current.filePath : null,
        nomorAgenda: current.nomorAgenda,
      };
    });
  }

  async softDelete(id: number, userId: number) {
    return db.transaction(async (tx) => {
      const [current] = await tx
        .select({ id: outgoingLetters.id })
        .from(outgoingLetters)
        .where(
          and(eq(outgoingLetters.id, id), isNull(outgoingLetters.deletedAt)),
        );
      if (!current) return false;
      await tx
        .update(outgoingLetters)
        .set({ deletedAt: new Date() })
        .where(eq(outgoingLetters.id, id));
      await tx
        .insert(outgoingLetterHistories)
        .values({
          letterId: id,
          userId,
          aktivitas: "Surat keluar dihapus (soft delete)",
          keterangan: "Data dinonaktifkan; dokumen dipertahankan",
        });
      return true;
    });
  }

  async history(id: number) {
    return db
      .select({
        aktivitas: outgoingLetterHistories.aktivitas,
        pengguna: users.name,
        keterangan: outgoingLetterHistories.keterangan,
        tanggal: outgoingLetterHistories.createdAt,
      })
      .from(outgoingLetterHistories)
      .innerJoin(users, eq(outgoingLetterHistories.userId, users.id))
      .where(eq(outgoingLetterHistories.letterId, id))
      .orderBy(asc(outgoingLetterHistories.id));
  }
}

export const outgoingLetterRepository = new OutgoingLetterRepository();
