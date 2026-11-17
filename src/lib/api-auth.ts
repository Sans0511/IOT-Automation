import type { Role } from "@prisma/client";
import jwt from "jsonwebtoken";
import type { NextRequest } from "next/server";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
}

export function getAuthenticatedUser(
  request: NextRequest,
): AuthenticatedUser | null {
  const token = request.cookies.get("access_token")?.value;
  const secret = process.env.JWT_ACCESS_SECRET;

  if (!token || !secret) {
    return null;
  }

  try {
    const payload = jwt.verify(token, secret);

    if (
      typeof payload === "string" ||
      payload.type !== "access" ||
      typeof payload.sub !== "string" ||
      typeof payload.email !== "string" ||
      (payload.role !== "ADMIN" && payload.role !== "USER")
    ) {
      return null;
    }

    return {
      id: payload.sub,
      email: payload.email,
      role: payload.role,
    };
  } catch {
    return null;
  }
}

export function canAccessOwner(
  user: AuthenticatedUser,
  ownerId: string,
): boolean {
  return user.role === "ADMIN" || user.id === ownerId;
}
