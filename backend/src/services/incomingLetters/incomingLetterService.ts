import { ClientError, NotFoundError } from "../../exceptions/clientError";
import { poolConnection } from "../../lib/db";
import {
  getIncomingLetterDocumentMime,
  readIncomingLetterDocument,
  removeIncomingLetterDocument,
  storeIncomingLetterDocument,
} from "./fileStorage";
import { incomingLetterRepository, type IncomingLetterFilters, type IncomingLetterRepository } from "./incomingLetterRepository";
import type { IncomingLetterPayload } from "./validator/schema";

export class IncomingLetterService {
  constructor(private repository: IncomingLetterRepository = incomingLetterRepository) {}

  async create(payload: IncomingLetterPayload, file: Express.Multer.File | undefined, userId: number) {
    if (!file) throw new ClientError("file_surat is required");
    const year = Number(payload.tanggal_diterima.slice(0, 4));
    const lockName = `incoming_letters_${year}`;
    const lockConnection = await poolConnection.getConnection();
    let lockAcquired = false;
    try {
      const [rows] = await lockConnection.query("SELECT GET_LOCK(?, 10) AS acquired", [lockName]);
      lockAcquired = Number((rows as Array<{ acquired: number }>)[0]?.acquired) === 1;
      if (!lockAcquired) throw new ClientError("Could not allocate an agenda number; please retry", 503);

      const sequence = (await this.repository.getMaxAgendaSequence(year)) + 1;
      const nomorAgenda = `SM-${String(sequence).padStart(3, "0")}/${year}`;
      const stored = await storeIncomingLetterDocument(file);
      try {
        const letter = await this.repository.createLetter(
          { ...payload, nomorAgenda, filePath: stored.filePath, fileName: stored.fileName, createdBy: userId },
        );
        return { id: letter.id, nomor_agenda: letter.nomorAgenda };
      } catch (error) {
        await removeIncomingLetterDocument(stored.filePath);
        throw error;
      }
    } finally {
      if (lockAcquired) await lockConnection.query("SELECT RELEASE_LOCK(?)", [lockName]).catch(() => undefined);
      lockConnection.release();
    }
  }

  async list(filters: IncomingLetterFilters) {
    const result = await this.repository.list(filters);
    return {
      data: result.data.map((letter) => ({
        id: letter.id,
        nomor_agenda: letter.nomorAgenda,
        nomor_surat: letter.nomorSurat,
        pengirim: letter.pengirim,
        perihal: letter.perihal,
        tanggal_surat: letter.tanggalSurat,
        tanggal_diterima: letter.tanggalDiterima,
        status: letter.status,
      })),
      pagination: {
        page: Math.floor(filters.offset / filters.limit) + 1,
        limit: filters.limit,
        total_items: result.total,
        total_pages: Math.ceil(result.total / filters.limit),
      },
    };
  }

  async getById(id: number) {
    const letter = await this.repository.findActiveById(id);
    if (!letter) throw new NotFoundError("Incoming letter not found");
    return {
      id: letter.id,
      nomor_agenda: letter.nomorAgenda,
      nomor_surat: letter.nomorSurat,
      tanggal_surat: letter.tanggalSurat,
      tanggal_diterima: letter.tanggalDiterima,
      pengirim: letter.pengirim,
      perihal: letter.perihal,
      jenis_surat: letter.jenisSurat,
      sumber_surat: letter.sumberSurat,
      keterangan: letter.keterangan,
      status: letter.status,
      file_name: letter.fileName,
    };
  }

  async update(id: number, payload: Partial<IncomingLetterPayload>, file: Express.Multer.File | undefined, userId: number) {
    if (Object.keys(payload).length === 0 && !file) throw new ClientError("No changes were provided");
    let stored: Awaited<ReturnType<typeof storeIncomingLetterDocument>> | undefined;
    if (file) stored = await storeIncomingLetterDocument(file);

    try {
      const result = await this.repository.updateLetter(
        id,
        { ...payload, ...(stored ? { filePath: stored.filePath, fileName: stored.fileName } : {}) },
        userId,
      );
      if (!result) throw new NotFoundError("Incoming letter not found");
      if (result.previousFilePath) await removeIncomingLetterDocument(result.previousFilePath);
      return { id: result.letter.id, nomor_agenda: result.letter.nomorAgenda };
    } catch (error) {
      if (stored) await removeIncomingLetterDocument(stored.filePath);
      throw error;
    }
  }

  async softDelete(id: number, userId: number) {
    const deleted = await this.repository.softDelete(id, userId);
    if (!deleted) throw new NotFoundError("Incoming letter not found");
  }

  async forward(id: number, userId: number) {
    const status = await this.repository.forwardToPrincipal(id, userId);
    if (!status) throw new NotFoundError("Incoming letter not found");
    return status;
  }

  async document(id: number) {
    const letter = await this.repository.findActiveById(id);
    if (!letter) throw new NotFoundError("Incoming letter not found");
    return {
      fileName: letter.fileName,
      mimeType: getIncomingLetterDocumentMime(letter.filePath),
      buffer: await readIncomingLetterDocument(letter.filePath),
    };
  }

  async history(id: number) {
    const letter = await this.repository.findActiveById(id);
    if (!letter) throw new NotFoundError("Incoming letter not found");
    const data = await this.repository.listHistory(id);
    return data.map((row) => ({
      aktivitas: row.aktivitas,
      pengguna: row.pengguna,
      keterangan: row.keterangan,
      tanggal: row.tanggal,
    }));
  }
}

export const incomingLetterService = new IncomingLetterService();
