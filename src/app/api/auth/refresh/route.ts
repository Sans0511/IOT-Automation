import { NextResponse, type NextRequest } from "next/server";
import { unauthorizedResponse } from "@/lib/api-helpers";
import {
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  REFRESH_AUDIENCE,
  REFRESH_TOKEN_TTL_SECONDS,
  type RefreshTokenPayload,
  signAccessToken,
  signRefreshToken,
  verifyToken,
} from "@/lib/jwt";
import { prisma } from "@/lib/prisma";
import {
  getRefreshSession,
  hashRefreshToken,
  revokeRefreshFamily,
  storeRefreshSession,
} from "@/lib/redis";

export async function POST(request: NextRequest) {
  const token = request.cookies.get("refresh_token")?.value;

  if (!token) {
    return unauthorizedResponse();
  }

  try {
    const payload = verifyToken<RefreshTokenPayload>(
      token,
      process.env.JWT_REFRESH_SECRET,
      REFRESH_AUDIENCE,
      REFRESH_TOKEN_TTL_SECONDS,
    );

    if (
      !payload ||
      payload.type !== "refresh" ||
      typeof payload.sub !== "string" ||
      typeof payload.familyId !== "string"
    ) {
      return unauthorizedResponse();
    }

    const session = await getRefreshSession(payload.sub);

    if (
      !session ||
      session.tokenHash !== hashRefreshToken(token) ||
      session.familyId !== payload.familyId
    ) {
      await revokeRefreshFamily(payload.familyId);
      return unauthorizedResponse();
    }

    const user = await prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      return unauthorizedResponse();
    }

    const accessToken = signAccessToken({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
    const refreshToken = signRefreshToken({
      sub: user.id,
      familyId: payload.familyId,
    });

    await storeRefreshSession(user.id, {
      tokenHash: hashRefreshToken(refreshToken),
      familyId: payload.familyId,
      expiresAtSeconds:
        Math.floor(Date.now() / 1000) + REFRESH_TOKEN_TTL_SECONDS,
    });

    const response = NextResponse.json({ ok: true });

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
  } catch {
    return unauthorizedResponse();
  }
}
