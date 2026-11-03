import type { Request, Response, NextFunction } from "express";
import {
  resolveSessionFromRequest,
  type PublicUser,
} from "../lib/auth";

declare global {
  namespace Express {
    interface Request {
      user?: PublicUser;
    }
  }
}

export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await resolveSessionFromRequest(req);
    req.user = user ?? undefined;
    next();
  } catch (err) {
    next(err);
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await resolveSessionFromRequest(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

export function getUserId(req: Request): number {
  const id = req.user?.id;
  if (id == null) {
    throw new Error("Authenticated user id missing on request");
  }
  return id;
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!req.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  if (req.user.role !== "admin") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  next();
}
