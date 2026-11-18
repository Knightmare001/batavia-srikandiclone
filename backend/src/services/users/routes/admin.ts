import { Router } from "express";
import { and, count, eq, isNull, like, or } from "drizzle-orm";
import bcrypt from "bcrypt";
import { db } from "../../../lib/db";
import { departments, roles, users } from "../../../lib/schema";
import { authenticate, authorizeRoles } from "../../../middleware/authMiddleware";
import { ClientError, NotFoundError } from "../../../exceptions/clientError";
import type { AuthenticatedRequest } from "../../../lib/jwt";
import type { NextFunction, Response } from "express";

const router = Router();
router.use(authenticate, authorizeRoles("admin"));
function id(value: unknown) { const n = typeof value === "string" ? Number(value) : NaN; if (!Number.isSafeInteger(n) || n <= 0) throw new ClientError("id must be a positive integer"); return n; }
router.get("/", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const page = Number(req.query.page ?? 1), limit = Number(req.query.limit ?? 10);
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new ClientError("Invalid pagination");
    const search = typeof req.query.search === "string" ? `%${req.query.search.trim()}%` : undefined;
    const where = and(search ? or(like(users.name, search), like(users.email, search), like(users.nip, search)) : undefined);
    const [countRows, rows] = await Promise.all([
      db.select({ total: count() }).from(users).where(where),
      db.select({ id: users.id, nip: users.nip, name: users.name, email: users.email, jabatan: users.jabatan, role_id: roles.id, role: roles.name, department_id: departments.id, department: departments.name, aktif: users.deletedAt }).from(users).innerJoin(roles, eq(users.roleId, roles.id)).leftJoin(departments, eq(users.departmentId, departments.id)).where(where).limit(limit).offset((page - 1) * limit),
    ]);
    const total = Number(countRows[0]?.total ?? 0);
    return res.json({ success: true, data: rows.map((u) => ({ ...u, aktif: u.aktif === null })), pagination: { page, limit, total, total_pages: Math.ceil(total / limit) } });
  } catch (error) { return next(error); }
});
router.get("/:id", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const [u] = await db.select({ id: users.id, nip: users.nip, name: users.name, email: users.email, jabatan: users.jabatan, role_id: roles.id, role: roles.name, department_id: departments.id, department: departments.name, deletedAt: users.deletedAt }).from(users).innerJoin(roles, eq(users.roleId, roles.id)).leftJoin(departments, eq(users.departmentId, departments.id)).where(eq(users.id, id(req.params.id)));
    if (!u) throw new NotFoundError("User not found");
    return res.json({ success: true, data: { ...u, aktif: u.deletedAt === null, deletedAt: undefined } });
  } catch (error) { return next(error); }
});
router.put("/:id", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const userId = id(req.params.id), body = req.body as Record<string, unknown>;
    const allowed = new Set(["name", "email", "nip", "role_id", "department_id", "jabatan"]);
    if (!body || typeof body !== "object" || Object.keys(body).length === 0 || Object.keys(body).some((key) => !allowed.has(key))) throw new ClientError("Invalid user update fields");
    const update: Partial<typeof users.$inferInsert> = {};
    if (body.name !== undefined) { if (typeof body.name !== "string" || !body.name.trim() || body.name.length > 150) throw new ClientError("Invalid name"); update.name = body.name.trim(); }
    if (body.email !== undefined) { if (typeof body.email !== "string" || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) throw new ClientError("Invalid email"); update.email = body.email.trim().toLowerCase(); }
    if (body.nip !== undefined) { if (typeof body.nip !== "string" || !/^\d{8,18}$/.test(body.nip)) throw new ClientError("Invalid NIP"); update.nip = body.nip; }
    if (body.role_id !== undefined) { const roleId = Number(body.role_id); if (!Number.isSafeInteger(roleId) || roleId < 1 || !(await db.select({ id: roles.id }).from(roles).where(eq(roles.id, roleId))).length) throw new ClientError("Invalid role_id"); update.roleId = roleId; }
    if (body.department_id !== undefined) { const departmentId = body.department_id === null ? null : Number(body.department_id); if (departmentId !== null && (!Number.isSafeInteger(departmentId) || !(await db.select({ id: departments.id }).from(departments).where(eq(departments.id, departmentId))).length)) throw new ClientError("Invalid department_id"); update.departmentId = departmentId; }
    if (body.jabatan !== undefined) { if (body.jabatan !== null && typeof body.jabatan !== "string") throw new ClientError("Invalid jabatan"); update.jabatan = body.jabatan as string | null; }
    await db.update(users).set(update).where(eq(users.id, userId));
    return res.json({ success: true, message: "Profil pengguna diperbarui" });
  } catch (error) { return next(error); }
});
router.patch("/:id/status", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const active = req.body?.aktif;
    if (typeof active !== "boolean") throw new ClientError("aktif must be a boolean");
    const userId = id(req.params.id);
    const result = await db.update(users).set({ deletedAt: active ? null : new Date() }).where(eq(users.id, userId));
    if (!result[0].affectedRows) throw new NotFoundError("User not found");
    return res.json({ success: true, aktif: active });
  } catch (error) { return next(error); }
});
router.patch("/:id/password", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const password = req.body?.password;
    if (typeof password !== "string" || password.length < 8 || !/[a-z]/i.test(password) || !/[0-9]/.test(password)) throw new ClientError("Password must contain at least 8 characters, letters, and numbers");
    const userId = id(req.params.id), hash = await bcrypt.hash(password, 10);
    const result = await db.update(users).set({ passwordHash: hash }).where(eq(users.id, userId));
    if (!result[0].affectedRows) throw new NotFoundError("User not found");
    return res.json({ success: true, message: "Password pengguna diperbarui" });
  } catch (error) { return next(error); }
});
export { router as userAdminRouter };
