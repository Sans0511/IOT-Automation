import type { Role } from "@prisma/client";
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";

export const JWT_ISSUER = "iot-automation";
export const ACCESS_AUDIENCE = "iot-web";
export const REFRESH_AUDIENCE = "iot-refresh";

export const ACCESS_TOKEN_TTL = "15m" as const;
export const ACCESS_TOKEN_MAX_AGE_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL = "7d" as const;
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export interface AccessTokenPayload extends JwtPayload {
  sub: string;
  email: string;
  role: Role;
  type: "access";
}

export interface RefreshTokenPayload extends JwtPayload {
  sub: string;
  familyId: string;
  type: "refresh";
}

function getSecret(name: "JWT_ACCESS_SECRET" | "JWT_REFRESH_SECRET"): string {
  const secret = process.env[name];

  if (!secret) {
    throw new Error(`${name} is not configured`);
  }

  return secret;
}

export function signAccessToken(payload: {
  sub: string;
  email: string;
  role: Role;
}): string {
  return jwt.sign(
    { ...payload, type: "access" } satisfies AccessTokenPayload,
    getSecret("JWT_ACCESS_SECRET"),
    {
      expiresIn: ACCESS_TOKEN_TTL,
      issuer: JWT_ISSUER,
      audience: ACCESS_AUDIENCE,
      algorithm: "HS256",
    } satisfies SignOptions,
  );
}

export function signRefreshToken(payload: {
  sub: string;
  familyId: string;
}): string {
  return jwt.sign(
    { ...payload, type: "refresh" } satisfies RefreshTokenPayload,
    getSecret("JWT_REFRESH_SECRET"),
    {
      expiresIn: REFRESH_TOKEN_TTL,
      issuer: JWT_ISSUER,
      audience: REFRESH_AUDIENCE,
      algorithm: "HS256",
    } satisfies SignOptions,
  );
}

export function verifyToken<T extends JwtPayload>(
  token: string,
  secret: string | undefined,
  audience: string,
  maxAgeSeconds: number,
): T | null {
  if (!token || !secret) {
    return null;
  }

  try {
    const payload = jwt.verify(token, secret, {
      algorithms: ["HS256"],
      issuer: JWT_ISSUER,
      audience,
      clockTolerance: 5,
      maxAge: maxAgeSeconds,
    });

    if (typeof payload === "string") {
      return null;
    }

    return payload as T;
  } catch {
    return null;
  }
}
