import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../../../lib/jwt";
import { ClientError } from "../../../exceptions/clientError";
import { outgoingLetterService } from "../outgoingLetterService";
import { validateOutgoingLetterPayload, type OutgoingLetterPayload } from "../validator/schema";

function id(value: unknown) {
  const parsed = typeof value === "string" ? Number(value) : NaN;
  if (!Number.isSafeInteger(parsed) || parsed <= 0) throw new ClientError("id must be a positive integer");
  return parsed;
}
function query(value: unknown) { return typeof value === "string" ? value.trim() : ""; }

export class OutgoingLetterController {
  list = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const page = Number(query(req.query.page) || "1");
      const limit = Number(query(req.query.limit) || "10");
      if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new ClientError("page must be positive and limit must be between 1 and 100");
      const yearText = query(req.query.tahun);
      const tahun = yearText ? Number(yearText) : undefined;
      if (yearText && (!/^\d{4}$/.test(yearText) || !tahun || tahun < 1900 || tahun > 9999)) throw new ClientError("tahun must be a valid four-digit year");
      return res.json({ success: true, ...(await outgoingLetterService.list({ search: query(req.query.search) || undefined, tahun, jenis: query(req.query.jenis) || undefined, page, limit })) });
    } catch (error) { return next(error); }
  };
  detail = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try { return res.json({ success: true, data: await outgoingLetterService.detail(id(req.params.id)) }); }
    catch (error) { return next(error); }
  };
  create = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      validateOutgoingLetterPayload(req.body);
      const data = await outgoingLetterService.create(req.body as OutgoingLetterPayload, req.file, req.authUser!.id);
      return res.status(201).json({ success: true, message: "Surat keluar berhasil dicatat", data });
    } catch (error) { return next(error); }
  };
  update = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      validateOutgoingLetterPayload(req.body, true);
      const data = await outgoingLetterService.update(id(req.params.id), req.body, req.file, req.authUser!.id);
      return res.json({ success: true, message: "Data surat keluar berhasil diperbarui", data });
    } catch (error) { return next(error); }
  };
  softDelete = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try { await outgoingLetterService.softDelete(id(req.params.id), req.authUser!.id); return res.json({ success: true, message: "Surat keluar berhasil dihapus" }); }
    catch (error) { return next(error); }
  };
  document = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try { const file = await outgoingLetterService.document(id(req.params.id)); res.setHeader("Content-Type", file.mimeType); res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`); return res.send(file.buffer); }
    catch (error) { return next(error); }
  };
  history = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try { return res.json({ success: true, data: await outgoingLetterService.history(id(req.params.id)) }); }
    catch (error) { return next(error); }
  };
}

export const outgoingLetterController = new OutgoingLetterController();
