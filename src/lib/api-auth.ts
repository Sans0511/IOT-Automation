import type { Role } from "@prisma/client";
import type { NextRequest } from "next/server";
import {
  ACCESS_AUDIENCE,
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  type AccessTokenPayload,
  verifyToken,
} from "@/lib/jwt";

export interface AuthenticatedUser {
  id: string;
  email: string;
  role: Role;
}

export function verifyAccessToken(token: string): AuthenticatedUser | null {
  const payload = verifyToken<AccessTokenPayload>(
    token,
    process.env.JWT_ACCESS_SECRET,
    ACCESS_AUDIENCE,
    ACCESS_TOKEN_MAX_AGE_SECONDS,
  );

  if (
    !payload ||
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
