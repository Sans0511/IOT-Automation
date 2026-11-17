import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { NextResponse, type NextRequest } from "next/server";
import { unauthorizedResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { getRefreshToken, storeRefreshToken } from "@/lib/redis";

const ACCESS_TOKEN_TTL = "15m" as const;
const ACCESS_TOKEN_MAX_AGE = 15 * 60;
const REFRESH_TOKEN_TTL = "7d" as const;
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

function getSecret(name: "JWT_ACCESS_SECRET" | "JWT_REFRESH_SECRET"): string {
  const secret = process.env[name];

  if (!secret) {
    throw new Error(`${name} is not configured`);
  }

  return secret;
}

interface RefreshTokenPayload extends JwtPayload {
  sub: string;
  type: "refresh";
}

export async function POST(request: NextRequest) {
  const token = request.cookies.get("refresh_token")?.value;

  if (!token) {
    return unauthorizedResponse();
  }

  try {
    const payload = jwt.verify(token, getSecret("JWT_REFRESH_SECRET"));

    if (
      typeof payload === "string" ||
      payload.type !== "refresh" ||
      typeof payload.sub !== "string"
    ) {
      return unauthorizedResponse();
    }

    const storedToken = await getRefreshToken(payload.sub);

    if (storedToken !== token) {
      return unauthorizedResponse();
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      return unauthorizedResponse();
    }

    const accessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        type: "access",
      },
      getSecret("JWT_ACCESS_SECRET"),
      { expiresIn: ACCESS_TOKEN_TTL } satisfies SignOptions,
    );
    const refreshToken = jwt.sign(
      { sub: user.id, type: "refresh" } satisfies RefreshTokenPayload,
      getSecret("JWT_REFRESH_SECRET"),
      { expiresIn: REFRESH_TOKEN_TTL } satisfies SignOptions,
    );

    await storeRefreshToken(user.id, refreshToken, REFRESH_TOKEN_TTL_SECONDS);

    const response = NextResponse.json({ ok: true });

    response.cookies.set("access_token", accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: ACCESS_TOKEN_MAX_AGE,
    });
    response.cookies.set("refresh_token", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: REFRESH_TOKEN_TTL_SECONDS,
    });
    response.headers.set("Cache-Control", "no-store");

    return response;
  } catch {
    return unauthorizedResponse();
  }
}
