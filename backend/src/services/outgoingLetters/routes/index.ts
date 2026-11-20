import { Router } from "express";
import {
  authenticate,
  authorizeRoles,
} from "../../../middleware/authMiddleware";
import { outgoingLetterController } from "../controller/outgoingLetterController";
import { outgoingLetterUpload } from "../upload";

const router = Router();
const canManage = [authenticate, authorizeRoles("tu", "admin")];
router.get("/", ...canManage, outgoingLetterController.list);
router.get("/:id/dokumen", ...canManage, outgoingLetterController.document);
router.get("/:id/riwayat", ...canManage, outgoingLetterController.history);
router.get("/:id", ...canManage, outgoingLetterController.detail);
router.post(
  "/",
  ...canManage,
  outgoingLetterUpload.single("file_surat"),
  outgoingLetterController.create,
);
router.put(
  "/:id",
  ...canManage,
  outgoingLetterUpload.single("file_surat"),
  outgoingLetterController.update,
);
router.delete("/:id", ...canManage, outgoingLetterController.softDelete);

export { router as outgoingLetterRouter };
