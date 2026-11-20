import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../../../lib/jwt";
import { ClientError } from "../../../exceptions/clientError";
import { dispositionService } from "../dispositionService";
import {
  validateFollowUpPayload,
  validateForwardPayload,
  validateInitialPayload,
} from "../validator/schema";

function id(value: unknown) {
  const parsed = typeof value === "string" ? Number(value) : NaN;
  if (!Number.isSafeInteger(parsed) || parsed <= 0)
    throw new ClientError("id must be a positive integer");
  return parsed;
}
function query(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export class DispositionController {
  monitor = async (
    _req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      return res.json({
        success: true,
        data: await dispositionService.monitor(),
      });
    } catch (error) {
      return next(error);
    }
  };
  inbox = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const page = Number(query(req.query.page) || "1");
      const limit = Number(query(req.query.limit) || "10");
      if (
        !Number.isSafeInteger(page) ||
        page < 1 ||
        !Number.isSafeInteger(limit) ||
        limit < 1 ||
        limit > 100
      )
        throw new ClientError(
          "page must be positive and limit must be between 1 and 100",
        );
      const status = query(req.query.status);
      const tab = query(req.query.tab);
      if (tab && !["active", "history"].includes(tab))
        throw new ClientError("tab must be active or history");
      const prioritas = query(req.query.prioritas);
      if (status && !["Belum Diproses", "Diproses", "Selesai"].includes(status))
        throw new ClientError("Invalid status filter");
      if (prioritas && !["Biasa", "Penting", "Segera"].includes(prioritas))
        throw new ClientError("Invalid prioritas filter");
      return res.json({
        success: true,
        ...(await dispositionService.inbox(
          req.authUser!.id,
          req.authUser!.role,
          {
            page,
            limit,
            tab: (tab || "active") as "active" | "history",
            status: status || undefined,
            prioritas: prioritas || undefined,
          },
        )),
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
      const data = await dispositionService.create(
        validateInitialPayload(req.body),
        req.authUser!.id,
      );
      return res
        .status(201)
        .json({ success: true, message: "Disposisi berhasil dibuat", data });
    } catch (error) {
      return next(error);
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
        data: await dispositionService.detail(
          id(req.params.id),
          req.authUser!.id,
          req.authUser!.role,
        ),
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
      const data = await dispositionService.forward(
        id(req.params.id),
        req.authUser!.id,
        req.authUser!.role,
        validateForwardPayload(req.body),
      );
      return res
        .status(201)
        .json({
          success: true,
          message: "Tugas lanjutan berhasil diteruskan",
          data,
        });
    } catch (error) {
      return next(error);
    }
  };
  followUp = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      const data = await dispositionService.updateFollowUp(
        id(req.params.id),
        req.authUser!.id,
        req.authUser!.role,
        validateFollowUpPayload(req.body),
      );
      return res.json({
        success: true,
        message: "Tindak lanjut berhasil diperbarui",
        data,
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
      const file = await dispositionService.document(
        id(req.params.id),
        req.authUser!.id,
        req.authUser!.role,
      );
      res.setHeader("Content-Type", file.mimeType);
      res.setHeader(
        "Content-Disposition",
        `inline; filename*=UTF-8''${encodeURIComponent(file.fileName)}`,
      );
      return res.send(file.buffer);
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
        data: await dispositionService.history(
          id(req.params.id),
          req.authUser!.id,
          req.authUser!.role,
        ),
      });
    } catch (error) {
      return next(error);
    }
  };
  tree = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      return res.json({
        success: true,
        data: await dispositionService.tree(id(req.params.letterId)),
      });
    } catch (error) {
      return next(error);
    }
  };
}
export const dispositionController = new DispositionController();
