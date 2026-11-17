import bcrypt from "bcryptjs";
import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { NextResponse, type NextRequest } from "next/server";
import type { Role } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { storeRefreshToken } from "@/lib/redis";

const ACCESS_TOKEN_TTL = "15m" as const;
const ACCESS_TOKEN_MAX_AGE = 15 * 60;
const REFRESH_TOKEN_TTL = "7d" as const;
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface AccessTokenPayload extends JwtPayload {
  sub: string;
  email: string;
  role: Role;
  type: "access";
}

interface RefreshTokenPayload extends JwtPayload {
  sub: string;
  type: "refresh";
}

function getSecret(name: "JWT_ACCESS_SECRET" | "JWT_REFRESH_SECRET"): string {
  const secret = process.env[name];

  if (!secret) {
    throw new Error(`${name} is not configured`);
  }

  return secret;
}

function isLoginInput(
  value: unknown,
): value is { email: string; password: string } {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const body = value as Record<string, unknown>;

  return (
    typeof body.email === "string" &&
    EMAIL_PATTERN.test(body.email) &&
    typeof body.password === "string" &&
    body.password.length > 0
  );
}

export async function POST(request: NextRequest) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isLoginInput(body)) {
    return NextResponse.json(
      { error: "A valid email and password are required" },
      { status: 400 },
    );
  }

  try {
    const accessSecret = getSecret("JWT_ACCESS_SECRET");
    const refreshSecret = getSecret("JWT_REFRESH_SECRET");
    const email = body.email.trim().toLowerCase();

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(body.password, user.password))) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    const accessToken = jwt.sign(
      {
        sub: user.id,
        email: user.email,
        role: user.role,
        type: "access",
      } satisfies AccessTokenPayload,
      accessSecret,
      { expiresIn: ACCESS_TOKEN_TTL } satisfies SignOptions,
    );

    const refreshToken = jwt.sign(
      { sub: user.id, type: "refresh" } satisfies RefreshTokenPayload,
      refreshSecret,
      { expiresIn: REFRESH_TOKEN_TTL } satisfies SignOptions,
    );

    await storeRefreshToken(user.id, refreshToken, REFRESH_TOKEN_TTL_SECONDS);

    const response = NextResponse.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });

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
  } catch (error) {
    console.error("Login failed:", error);
    return NextResponse.json(
      { error: "Unable to complete login" },
      { status: 500 },
    );
  }
}
