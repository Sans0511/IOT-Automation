import { randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  signAccessToken,
  signRefreshToken,
} from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import { hashRefreshToken, storeRefreshSession } from "@/lib/redis";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
    const email = body.email.trim().toLowerCase();

    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(body.password, user.password))) {
      return NextResponse.json(
        { error: "Invalid email or password" },
        { status: 401 },
      );
    }

    const familyId = randomUUID();
    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = signRefreshToken({ sub: user.id, familyId });

    await storeRefreshSession(user.id, {
      tokenHash: hashRefreshToken(refreshToken),
      familyId,
      expiresAtSeconds:
        Math.floor(Date.now() / 1000) + REFRESH_TOKEN_TTL_SECONDS,
    });

    const response = NextResponse.json({
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
      maxAge: ACCESS_TOKEN_MAX_AGE_SECONDS,
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
