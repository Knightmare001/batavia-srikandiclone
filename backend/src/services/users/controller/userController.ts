import { type Request, type Response, type NextFunction } from "express";
import { userService, type UserService } from "../userService";
import { validateLoginPayload, validateUserPayload } from "../validator/schema";
import { verifyAccessToken } from "../../../lib/jwt";
import { writeAuditLog } from "../../../lib/auditLogger";

export class UserController {
  constructor(private service: UserService = userService) {}

  createUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      validateUserPayload(req.body);
      const data = await this.service.createUser(req.body);

      return res.status(201).json({
        message: "success created account",
        data,
      });
    } catch (error) {
      next(error);
    }
  };

  loginUser = async (req: Request, res: Response, next: NextFunction) => {
    try {
      validateLoginPayload(req.body);
      const data = await this.service.loginUser(req.body);
      const token = await verifyAccessToken(data.access_token);
      void writeAuditLog({ userId: Number(token.sub), roleName: String(token.role ?? "unknown"), modul: "auth", aktivitas: "Login berhasil", ipAddress: req.ip }).catch((error) => console.error("Audit log write failed", error));

      return res.status(200).json({
        message: "success Login account",
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}

export const userController = new UserController();

