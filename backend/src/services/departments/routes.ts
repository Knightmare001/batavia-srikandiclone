import { Router } from "express";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "../../lib/db";
import { departments } from "../../lib/schema";
import { authenticate, authorizeRoles } from "../../middleware/authMiddleware";
import { ClientError, NotFoundError } from "../../exceptions/clientError";
import type { AuthenticatedRequest } from "../../lib/jwt";
import type { NextFunction, Response } from "express";
const router = Router();
router.use(authenticate);
router.get(
  "/",
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const includeInactive =
        req.authUser?.role === "admin" && req.query.include_inactive === "true";
      const rows = await db
        .select()
        .from(departments)
        .where(includeInactive ? undefined : isNull(departments.deletedAt))
        .orderBy(asc(departments.name));
      return res.json({
        success: true,
        data: rows.map((row) => ({ ...row, aktif: row.deletedAt === null })),
      });
    } catch (e) {
      return next(e);
    }
  },
);
function departmentName(value: unknown) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > 100)
    throw new ClientError("name must be between 1 and 100 characters");
  return value.trim();
}
function parseId(value: unknown) {
  const id = typeof value === "string" ? Number(value) : NaN;
  if (!Number.isSafeInteger(id) || id <= 0)
    throw new ClientError("id must be a positive integer");
  return id;
}
router.post(
  "/",
  authorizeRoles("admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const name = departmentName(req.body?.name);
      const [inserted] = await db.insert(departments).values({ name });
      return res
        .status(201)
        .json({ success: true, data: { id: Number(inserted.insertId), name } });
    } catch (e) {
      return next(e);
    }
  },
);
router.put(
  "/:id",
  authorizeRoles("admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id),
        name = departmentName(req.body?.name);
      const [found] = await db
        .select({ id: departments.id })
        .from(departments)
        .where(and(eq(departments.id, id), isNull(departments.deletedAt)));
      if (!found) throw new NotFoundError("Active unit kerja not found");
      await db.update(departments).set({ name }).where(eq(departments.id, id));
      return res.json({ success: true, data: { id, name } });
    } catch (e) {
      return next(e);
    }
  },
);
router.patch(
  "/:id/status",
  authorizeRoles("admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id),
        active = req.body?.aktif;
      if (typeof active !== "boolean")
        throw new ClientError("aktif must be a boolean");
      const [found] = await db
        .select({ id: departments.id })
        .from(departments)
        .where(eq(departments.id, id));
      if (!found) throw new NotFoundError("Unit kerja not found");
      await db
        .update(departments)
        .set({ deletedAt: active ? null : new Date() })
        .where(eq(departments.id, id));
      return res.json({ success: true, id, aktif: active });
    } catch (e) {
      return next(e);
    }
  },
);
router.delete(
  "/:id",
  authorizeRoles("admin"),
  async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const id = parseId(req.params.id);
      const [found] = await db
        .select({ id: departments.id })
        .from(departments)
        .where(and(eq(departments.id, id), isNull(departments.deletedAt)));
      if (!found) throw new NotFoundError("Active unit kerja not found");
      await db
        .update(departments)
        .set({ deletedAt: new Date() })
        .where(eq(departments.id, id));
      return res.json({ success: true, message: "Unit kerja dinonaktifkan" });
    } catch (e) {
      return next(e);
    }
  },
);
export { router as departmentRouter };
