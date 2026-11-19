import { Router } from "express";
import { authenticate, authorizeRoles } from "../../../middleware/authMiddleware";
import { incomingLetterController } from "../controller/incomingLetterController";
import { incomingLetterUpload } from "../upload";

const incomingLetterRouter = Router();
const canManageLetters = [authenticate, authorizeRoles("tu", "admin")];
const canReadLetters = [authenticate, authorizeRoles("tu", "admin", "kepala_sekolah")];

incomingLetterRouter.get("/", ...canReadLetters, incomingLetterController.list);
incomingLetterRouter.get("/:id/dokumen", ...canReadLetters, incomingLetterController.document);
incomingLetterRouter.get("/:id/riwayat", ...canReadLetters, incomingLetterController.history);
incomingLetterRouter.get("/:id", ...canReadLetters, incomingLetterController.getById);
incomingLetterRouter.post("/", ...canManageLetters, incomingLetterUpload.single("file_surat"), incomingLetterController.create);
incomingLetterRouter.put("/:id", ...canManageLetters, incomingLetterUpload.single("file_surat"), incomingLetterController.update);
incomingLetterRouter.delete("/:id", ...canManageLetters, incomingLetterController.softDelete);
incomingLetterRouter.post("/:id/teruskan", ...canManageLetters, incomingLetterController.forward);

export { incomingLetterRouter };
