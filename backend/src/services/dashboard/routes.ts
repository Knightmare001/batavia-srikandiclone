import { Router } from "express";
import { authenticate } from "../../middleware/authMiddleware";
import type { AuthenticatedRequest } from "../../lib/jwt";
import type { NextFunction, Response } from "express";
import { dashboardService } from "./dashboardService";
const router = Router();
router.get("/", authenticate, async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try { return res.json({ success: true, role: req.authUser!.role, data: await dashboardService.get(req.authUser!.id, req.authUser!.role) }); }
  catch (error) { return next(error); }
});
export { router as dashboardRouter };
