import type { NextFunction, Response } from "express";
import type { AuthenticatedRequest } from "../../lib/jwt";
import { ClientError } from "../../exceptions/clientError";
import { notificationService } from "./notificationService";

function parseId(value: unknown) {
  const id = typeof value === "string" ? Number(value) : NaN;
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new ClientError("id must be a positive integer");
  return id;
}
export class NotificationController {
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
      return res.json({
        success: true,
        ...(await notificationService.list(req.authUser!.id, page, limit)),
      });
    } catch (error) {
      return next(error);
    }
  };
  read = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      await notificationService.read(req.authUser!.id, parseId(req.params.id));
      return res.json({
        success: true,
        message: "Notifikasi ditandai telah dibaca",
      });
    } catch (error) {
      return next(error);
    }
  };
  readAll = async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction,
  ) => {
    try {
      await notificationService.readAll(req.authUser!.id);
      return res.json({
        success: true,
        message: "Seluruh notifikasi ditandai telah dibaca",
      });
    } catch (error) {
      return next(error);
    }
  };
}
export const notificationController = new NotificationController();
