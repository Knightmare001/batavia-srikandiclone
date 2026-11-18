import { Router } from "express";
import { authenticate, authorizeRoles } from "../../../middleware/authMiddleware";
import { dispositionController } from "../controller/dispositionController";

const router = Router();
router.get("/inbox", authenticate, dispositionController.inbox);
router.get("/surat/:letterId", authenticate, dispositionController.tree);
router.post("/", authenticate, authorizeRoles("kepala_sekolah", "admin"), dispositionController.create);
router.get("/:id/dokumen", authenticate, dispositionController.document);
router.get("/:id/riwayat", authenticate, dispositionController.history);
router.get("/:id", authenticate, dispositionController.detail);
router.post("/:id/teruskan", authenticate, dispositionController.forward);
router.patch("/:id/tindak-lanjut", authenticate, dispositionController.followUp);
export { router as dispositionRouter };
