import { Router } from "express";
import { authenticate, authorizeRoles } from "../../../middleware/authMiddleware";
import { dispositionController } from "../controller/dispositionController";

const router = Router();
router.get("/inbox", authenticate, authorizeRoles("admin", "kepala_sekolah", "pegawai"), dispositionController.inbox);
router.get("/surat/:letterId", authenticate, authorizeRoles("admin", "kepala_sekolah"), dispositionController.tree);
router.get("/monitor", authenticate, authorizeRoles("admin", "tu", "kepala_sekolah"), dispositionController.monitor);
router.post("/", authenticate, authorizeRoles("kepala_sekolah", "admin"), dispositionController.create);
router.get("/:id/dokumen", authenticate, dispositionController.document);
router.get("/:id/riwayat", authenticate, dispositionController.history);
router.get("/:id", authenticate, dispositionController.detail);
router.post("/:id/teruskan", authenticate, dispositionController.forward);
router.patch("/:id/tindak-lanjut", authenticate, dispositionController.followUp);
export { router as dispositionRouter };
