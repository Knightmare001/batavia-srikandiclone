import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../../lib/jwt";
import { ClientError } from "../../exceptions/clientError";
import { archiveService } from "./archiveService";
function param(value: unknown) {
  const n = typeof value === "string" ? Number(value) : NaN;
  if (!Number.isSafeInteger(n) || n <= 0)
    throw new ClientError("id must be a positive integer");
  return n;
}
export class ArchiveController {
  list = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const page = Number(req.query.page ?? 1),
        limit = Number(req.query.limit ?? 10);
      if (
        !Number.isSafeInteger(page) ||
        page < 1 ||
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > 100
      )
        throw new ClientError("Invalid pagination");
      const yearText =
        typeof req.query.tahun === "string" ? req.query.tahun : "";
      const monthText =
        typeof req.query.bulan === "string" ? req.query.bulan : "";
      const tahun = yearText ? Number(yearText) : undefined,
        bulan = monthText ? Number(monthText) : undefined;
      if (
        yearText &&
        (!/^\d{4}$/.test(yearText) || !tahun || tahun < 1900 || tahun > 9999)
      )
        throw new ClientError("tahun must be a valid four-digit year");
      if (monthText && (!Number.isInteger(bulan) || bulan! < 1 || bulan! > 12))
        throw new ClientError("bulan must be between 1 and 12");
      const jenis = typeof req.query.jenis === "string" ? req.query.jenis : "";
      if (jenis && !["surat_masuk", "surat_keluar"].includes(jenis))
        throw new ClientError("Invalid jenis filter");
      return res.json({
        success: true,
        ...(await archiveService.list({
          search:
            typeof req.query.search === "string"
              ? req.query.search.trim()
              : undefined,
          jenis: jenis || undefined,
          tahun,
          bulan,
          status:
            typeof req.query.status === "string" ? req.query.status : undefined,
          page,
          limit,
        })),
      });
    } catch (e) {
      return next(e);
    }
  };
  detail = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      return res.json({
        success: true,
        data: await archiveService.detail(
          String(req.params.jenis ?? ""),
          param(req.params.id),
        ),
      });
    } catch (e) {
      return next(e);
    }
  };
  statistics = async (
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      return res.json({
        success: true,
        data: await archiveService.statistics(),
      });
    } catch (e) {
      return next(e);
    }
  };
}
export const archiveController = new ArchiveController();
