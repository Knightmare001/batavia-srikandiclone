import { Router } from "express";
import { asc, eq } from "drizzle-orm";
import { db } from "../../lib/db";
import { departments } from "../../lib/schema";
import { authenticate, authorizeRoles } from "../../middleware/authMiddleware";
import { ClientError, NotFoundError } from "../../exceptions/clientError";
import type { AuthenticatedRequest } from "../../lib/jwt";
import type { NextFunction, Response } from "express";
const router = Router();
router.use(authenticate, authorizeRoles("admin"));
router.get("/", async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { return res.json({ success: true, data: await db.select().from(departments).orderBy(asc(departments.name)) }); } catch (e) { return next(e); } });
function departmentName(value: unknown) { if (typeof value !== "string" || !value.trim() || value.trim().length > 100) throw new ClientError("name must be between 1 and 100 characters"); return value.trim(); }
function parseId(value: unknown) { const id = typeof value === "string" ? Number(value) : NaN; if (!Number.isSafeInteger(id) || id <= 0) throw new ClientError("id must be a positive integer"); return id; }
router.post("/", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const name = departmentName(req.body?.name); const [inserted] = await db.insert(departments).values({ name }); return res.status(201).json({ success: true, data: { id: Number(inserted.insertId), name } }); } catch (e) { return next(e); } });
router.put("/:id", async (req: AuthenticatedRequest, res: Response, next: NextFunction) => { try { const id = parseId(req.params.id), name = departmentName(req.body?.name); const [found] = await db.select({ id: departments.id }).from(departments).where(eq(departments.id, id)); if (!found) throw new NotFoundError("Department not found"); await db.update(departments).set({ name }).where(eq(departments.id, id)); return res.json({ success: true, data: { id, name } }); } catch (e) { return next(e); } });
export { router as departmentRouter };
