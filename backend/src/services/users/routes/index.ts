import { Router } from "express";
import { userController } from "../controller/userController";

const userRouter = Router();

userRouter.post("/register-user", userController.createUser);
userRouter.post("/login-user", userController.loginUser);

export { userRouter };

