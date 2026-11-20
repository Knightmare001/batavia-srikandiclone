import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../../../lib/jwt";
import { ClientError } from "../../../exceptions/clientError";
import {
  IncomingLetterService,
  incomingLetterService,
} from "../incomingLetterService";
import { validateIncomingLetterPayload } from "../validator/schema";

function getId(value: unknown) {
  if (typeof value !== "string")
    throw new ClientError("id must be a positive integer");
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new ClientError("id must be a positive integer");
  return id;
}

function getQueryString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export class IncomingLetterController {
  constructor(private service: IncomingLetterService = incomingLetterService) {}

  list = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const page = Number(getQueryString(req.query.page) || "1");
      const limit = Number(getQueryString(req.query.limit) || "10");
      if (
        !Number.isSafeInteger(page) ||
        page < 1 ||
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > 100
      ) {
        throw new ClientError(
          "page must be positive and limit must be between 1 and 100",
        );
      }

      const yearValue = getQueryString(req.query.tahun);
      const year = yearValue ? Number(yearValue) : undefined;
      if (
        yearValue &&
        (!/^\d{4}$/.test(yearValue) || !year || year < 1900 || year > 9999)
      ) {
        throw new ClientError("tahun must be a valid four-digit year");
      }

      const result = await this.service.list({
        search: getQueryString(req.query.search) || undefined,
        status: getQueryString(req.query.status) || undefined,
        year,
        limit,
        offset: (page - 1) * limit,
      });
      return res.json({ success: true, ...result });
    } catch (error) {
      return next(error);
    }
  };

  getById = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      return res.json({
        success: true,
        data: await this.service.getById(getId(req.params.id)),
      });
    } catch (error) {
      return next(error);
    }
  };

  create = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      validateIncomingLetterPayload(req.body);
      const data = await this.service.create(
        req.body,
        req.file,
        req.authUser!.id,
      );
      return res
        .status(201)
        .json({ success: true, message: "Surat masuk berhasil dicatat", data });
    } catch (error) {
      return next(error);
    }
  };

  update = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      validateIncomingLetterPayload(req.body, true);
      const data = await this.service.update(
        getId(req.params.id),
        req.body,
        req.file,
        req.authUser!.id,
      );
      return res.json({
        success: true,
        message: "Surat masuk berhasil diperbarui",
        data,
      });
    } catch (error) {
      return next(error);
    }
  };

  softDelete = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      await this.service.softDelete(getId(req.params.id), req.authUser!.id);
      return res.json({
        success: true,
        message: "Surat masuk berhasil dihapus",
      });
    } catch (error) {
      return next(error);
    }
  };

  forward = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const status = await this.service.forward(
        getId(req.params.id),
        req.authUser!.id,
      );
      return res.json({
        success: true,
        message: "Surat berhasil diteruskan kepada Kepala Sekolah",
        status,
      });
    } catch (error) {
      return next(error);
    }
  };

  document = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const document = await this.service.document(getId(req.params.id));
      res.setHeader("Content-Type", document.mimeType);
      res.setHeader(
        "Content-Disposition",
        `inline; filename*=UTF-8''${encodeURIComponent(document.fileName)}`,
      );
      return res.send(document.buffer);
    } catch (error) {
      return next(error);
    }
  };

  history = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      return res.json({
        success: true,
        data: await this.service.history(getId(req.params.id)),
      });
    } catch (error) {
      return next(error);
    }
  };
}

export const incomingLetterController = new IncomingLetterController();
