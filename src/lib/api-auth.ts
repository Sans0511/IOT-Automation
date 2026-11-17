import type { Role } from "@prisma/client";
import jwt from "jsonwebtoken";
import type { NextRequest } from "next/server";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
}

export function verifyAccessToken(token: string): AuthenticatedUser | null {
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

function readCookie(cookieHeader: string, name: string): string | null {
  for (const entry of cookieHeader.split(";")) {
    const separator = entry.indexOf("=");

    if (separator === -1) {
      continue;
    }

    if (entry.slice(0, separator).trim() === name) {
      return decodeURIComponent(entry.slice(separator + 1).trim());
    }
  }

  return null;
}

export function getAuthenticatedUser(
  request: NextRequest,
): AuthenticatedUser | null {
  return verifyAccessToken(request.cookies.get("access_token")?.value ?? "");
}

export function getAuthenticatedUserFromCookieHeader(
  cookieHeader: string | null | undefined,
): AuthenticatedUser | null {
  if (!cookieHeader) {
    return null;
  }

  return verifyAccessToken(readCookie(cookieHeader, "access_token") ?? "");
}

export function canAccessOwner(
  user: AuthenticatedUser,
  ownerId: string,
): boolean {
  return user.role === "ADMIN" || user.id === ownerId;
}
