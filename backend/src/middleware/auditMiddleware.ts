import type { NextFunction, Request, Response } from "express";
import type { AuthenticatedRequest } from "../lib/jwt";
import { writeAuditLog } from "../lib/auditLogger";

const moduleForPath = (path: string) => path.includes("surat-masuk") ? "surat_masuk" : path.includes("surat-keluar") ? "surat_keluar" : path.includes("disposisi") ? "disposisi" : path.includes("departments") ? "departments" : path.includes("users") ? "users" : path.includes("notifications") ? "sistem" : "auth";
export function auditMiddleware(req: Request, res: Response, next: NextFunction) {
  res.once("finish", () => {
    const actor = (req as AuthenticatedRequest).authUser;
    if (!actor || !["POST", "PUT", "PATCH", "DELETE"].includes(req.method) || res.statusCode >= 400) return;
    const modul = moduleForPath(req.path);
    void writeAuditLog({ userId: actor.id, roleName: actor.role, modul, aktivitas: `${req.method} ${req.path}`.slice(0, 100), deskripsi: "Operasi berhasil", ipAddress: req.ip }).catch((error) => console.error("Audit log write failed", error));
  });
  next();
}
