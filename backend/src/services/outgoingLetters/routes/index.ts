import { Router } from "express";
import { authenticate, authorizeRoles } from "../../../middleware/authMiddleware";
import { outgoingLetterController } from "../controller/outgoingLetterController";
import { outgoingLetterUpload } from "../upload";

const router = Router();
const canManage = [authenticate, authorizeRoles("tu", "admin")];
router.get("/", authenticate, outgoingLetterController.list);
router.get("/:id/dokumen", authenticate, outgoingLetterController.document);
router.get("/:id/riwayat", authenticate, outgoingLetterController.history);
router.get("/:id", authenticate, outgoingLetterController.detail);
router.post("/", ...canManage, outgoingLetterUpload.single("file_surat"), outgoingLetterController.create);
router.put("/:id", ...canManage, outgoingLetterUpload.single("file_surat"), outgoingLetterController.update);
router.delete("/:id", ...canManage, outgoingLetterController.softDelete);

export { router as outgoingLetterRouter };
