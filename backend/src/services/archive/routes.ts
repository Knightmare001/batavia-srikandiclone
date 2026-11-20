import { Router } from "express";
import { authenticate, authorizeRoles } from "../../middleware/authMiddleware";
import { archiveController } from "./controller";
const router = Router();
const canViewArchive = [
  authenticate,
  authorizeRoles("admin", "tu", "kepala_sekolah"),
];
router.get("/statistik", ...canViewArchive, archiveController.statistics);
router.get("/:jenis/:id", ...canViewArchive, archiveController.detail);
router.get("/", ...canViewArchive, archiveController.list);
export { router as archiveRouter };
