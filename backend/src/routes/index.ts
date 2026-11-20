import { Router, type Request, type Response } from "express";
import { userRouter } from "../services/users/routes";
import { incomingLetterRouter } from "../services/incomingLetters/routes";
import { poolConnection } from "../lib/db";
import { dispositionRouter } from "../services/dispositions/routes";
import { outgoingLetterRouter } from "../services/outgoingLetters/routes";
import { archiveRouter } from "../services/archive/routes";
import { dashboardRouter } from "../services/dashboard/routes";
import { userAdminRouter } from "../services/users/routes/admin";
import { departmentRouter } from "../services/departments/routes";
import { notificationRouter } from "../services/notifications/routes";

const router = Router();

// Health Check
router.get("/health", async (_req: Request, res: Response) => {
  let dbStatus = "disconnected";
  try {
    const conn = await poolConnection.getConnection();
    await conn.ping();
    conn.release();
    dbStatus = "connected";
  } catch (error: any) {
    dbStatus = `unreachable (${error?.message || "unknown error"})`;
  }

  res.json({
    status: "ok",
    runtime: "nodejs",
    timestamp: new Date().toISOString(),
    services: {
      server: "healthy",
      database: dbStatus,
    },
  });
});

// Domain Routes
router.use("/api/v1/auth", userRouter);
router.use("/api/v1/users", userAdminRouter);
router.use("/api/v1/departments", departmentRouter);
router.use("/api/v1/notifications", notificationRouter);
router.use("/api/v1/arsip", archiveRouter);
router.use("/api/v1/dashboard", dashboardRouter);
router.use("/api/v1/surat-masuk", incomingLetterRouter);
router.use("/api/v1/disposisi", dispositionRouter);
router.use("/api/v1/surat-keluar", outgoingLetterRouter);

export default router;
