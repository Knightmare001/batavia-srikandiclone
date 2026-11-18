import { Router } from "express";
import { authenticate } from "../../middleware/authMiddleware";
import { archiveController } from "./controller";
const router = Router();
router.get("/statistik", authenticate, archiveController.statistics);
router.get("/:jenis/:id", authenticate, archiveController.detail);
router.get("/", authenticate, archiveController.list);
export { router as archiveRouter };
