import { ClientError, NotFoundError } from "../../exceptions/clientError";
import { poolConnection } from "../../lib/db";
import { outgoingLetterRepository, type OutgoingLetterRepository } from "./outgoingLetterRepository";
import { outgoingDocumentMime, readOutgoingDocument, removeOutgoingDocument, storeOutgoingDocument } from "./fileStorage";
import type { OutgoingLetterPayload } from "./validator/schema";

export class OutgoingLetterService {
  constructor(private repository: OutgoingLetterRepository = outgoingLetterRepository) {}

  async create(payload: OutgoingLetterPayload, file: Express.Multer.File | undefined, userId: number) {
    if (!file) throw new ClientError("file_surat is required");
    const year = Number(payload.tanggal_surat.slice(0, 4));
    const lockName = `outgoing_letters_${year}`;
    const connection = await poolConnection.getConnection();
    let acquired = false;
    let stored: Awaited<ReturnType<typeof storeOutgoingDocument>> | undefined;
    try {
      const [rows] = await connection.query("SELECT GET_LOCK(?, 10) AS acquired", [lockName]);
      acquired = Number((rows as Array<{ acquired: number }>)[0]?.acquired) === 1;
      if (!acquired) throw new ClientError("Could not allocate an agenda number; please retry", 503);
      const sequence = await this.repository.nextSequence(year);
      const nomorAgenda = `SK-${String(sequence).padStart(3, "0")}/${year}`;
      stored = await storeOutgoingDocument(file);
      const result = await this.repository.create({ ...payload, nomorAgenda, filePath: stored.filePath, fileName: stored.fileName, createdBy: userId });
      return { id_surat_keluar: result.id, nomor_agenda: result.nomorAgenda, nomor_surat: payload.nomor_surat, perihal: payload.perihal, pembuat_surat: payload.pembuat_surat, tujuan_surat: payload.tujuan_surat, status_surat: "Tercatat" };
    } catch (error) {
      if (stored) await removeOutgoingDocument(stored.filePath);
      throw error;
    } finally {
      if (acquired) await connection.query("SELECT RELEASE_LOCK(?)", [lockName]).catch(() => undefined);
      connection.release();
    }
  }

  async list(filters: { search?: string; tahun?: number; jenis?: string; page: number; limit: number }) {
    const result = await this.repository.list({ ...filters, offset: (filters.page - 1) * filters.limit });
    return {
      data: result.data.map((letter) => ({ id_surat_keluar: letter.id, nomor_agenda: letter.nomorAgenda, nomor_surat: letter.nomorSurat, tanggal_surat: letter.tanggalSurat, pembuat_surat: letter.pembuatSurat, tujuan_surat: letter.tujuanSurat, perihal: letter.perihal, status_surat: letter.statusSurat })),
      pagination: { page: filters.page, limit: filters.limit, total: result.total, total_pages: Math.ceil(result.total / filters.limit) },
    };
  }

  async detail(id: number) {
    const letter = await this.repository.findActive(id);
    if (!letter) throw new NotFoundError("Outgoing letter not found");
    return { id_surat_keluar: letter.id, nomor_agenda: letter.nomorAgenda, nomor_surat: letter.nomorSurat, tanggal_surat: letter.tanggalSurat, tanggal_dikirim: letter.tanggalDikirim, pembuat_surat: letter.pembuatSurat, tujuan_surat: letter.tujuanSurat, perihal: letter.perihal, jenis_surat: letter.jenisSurat, file_name: letter.fileName, keterangan: letter.keterangan, status_surat: letter.statusSurat };
  }

  async update(id: number, payload: Partial<OutgoingLetterPayload>, file: Express.Multer.File | undefined, userId: number) {
    if (Object.keys(payload).length === 0 && !file) throw new ClientError("No changes were provided");
    const stored = file ? await storeOutgoingDocument(file) : undefined;
    try {
      const result = await this.repository.update(id, { ...payload, ...(stored ? { filePath: stored.filePath, fileName: stored.fileName } : {}) }, userId);
      if (!result) throw new NotFoundError("Outgoing letter not found");
      if (result.previousFilePath) await removeOutgoingDocument(result.previousFilePath);
      return { id_surat_keluar: id, nomor_agenda: result.nomorAgenda };
    } catch (error) {
      if (stored) await removeOutgoingDocument(stored.filePath);
      throw error;
    }
  }

  async softDelete(id: number, userId: number) {
    if (!await this.repository.softDelete(id, userId)) throw new NotFoundError("Outgoing letter not found");
  }

  async document(id: number) {
    const letter = await this.repository.findActive(id);
    if (!letter) throw new NotFoundError("Outgoing letter not found");
    return { fileName: letter.fileName, mimeType: outgoingDocumentMime(letter.filePath), buffer: await readOutgoingDocument(letter.filePath) };
  }

  async history(id: number) {
    if (!await this.repository.findActive(id)) throw new NotFoundError("Outgoing letter not found");
    return this.repository.history(id);
  }
}

export const outgoingLetterService = new OutgoingLetterService();
