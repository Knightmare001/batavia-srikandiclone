import { Router } from "express";
import { userController } from "../controller/userController";
import {
  authenticate,
  authorizeRoles,
} from "../../../middleware/authMiddleware";

const userRouter = Router();

userRouter.post(
  "/register-user",
  authenticate,
  authorizeRoles("admin"),
  userController.createUser,
);
userRouter.post("/login-user", userController.loginUser);

export { userRouter };
