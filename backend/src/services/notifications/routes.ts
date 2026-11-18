import { Router } from "express";
import { authenticate } from "../../middleware/authMiddleware";
import { notificationController } from "./controller";
const router = Router();
router.get("/", authenticate, notificationController.list);
router.patch("/read-all", authenticate, notificationController.readAll);
router.patch("/:id/read", authenticate, notificationController.read);
export { router as notificationRouter };
