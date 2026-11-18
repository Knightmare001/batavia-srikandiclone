import { and, eq, isNull } from "drizzle-orm";
import type { NextFunction, Response } from "express";
import { verifyAccessToken, type AuthenticatedRequest } from "../lib/jwt";
import { db } from "../lib/db";
import { roles, users } from "../lib/schema";

export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authorization = req.get("authorization");
  const [scheme, token] = authorization?.split(" ") ?? [];
  if (scheme !== "Bearer" || !token) {
    return res.status(401).json({ message: "authentication required", data: null });
  }

  let userId: number;
  try {
    const payload = await verifyAccessToken(token);
    userId = Number(payload.sub);
    if (!Number.isSafeInteger(userId) || userId <= 0) {
      return res.status(401).json({ message: "invalid or expired token", data: null });
    }
  } catch {
    return res.status(401).json({ message: "invalid or expired token", data: null });
  }

  try {
    const [user] = await db
      .select({ id: users.id, role: roles.name })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(and(eq(users.id, userId), isNull(users.deletedAt)));

    if (!user) {
      return res.status(401).json({ message: "invalid or expired token", data: null });
    }

    req.authUser = { id: user.id, role: user.role };
    return next();
  } catch (error) {
    return next(error);
  }
}

export function authorizeRoles(...allowedRoles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.authUser || !allowedRoles.includes(req.authUser.role)) {
      return res.status(403).json({ message: "forbidden", data: null });
    }
    return next();
  };
}
