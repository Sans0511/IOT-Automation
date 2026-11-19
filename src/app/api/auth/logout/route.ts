import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import { serverErrorResponse, unauthorizedResponse } from "@/lib/api-helpers";
import {
  REFRESH_AUDIENCE,
  REFRESH_TOKEN_TTL_SECONDS,
  type RefreshTokenPayload,
  verifyToken,
} from "@/lib/jwt";
import { deleteRefreshSession, revokeRefreshFamily } from "@/lib/redis";

function clearAuthCookies(response: NextResponse): void {
  const options = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: 0,
  };

  response.cookies.set("access_token", "", options);
  response.cookies.set("refresh_token", "", options);
}

export async function POST(request: NextRequest) {
  const user = getAuthenticatedUser(request);
  const refreshToken = request.cookies.get("refresh_token")?.value ?? "";
  const refreshPayload = verifyToken<RefreshTokenPayload>(
    refreshToken,
    process.env.JWT_REFRESH_SECRET,
    REFRESH_AUDIENCE,
    REFRESH_TOKEN_TTL_SECONDS,
  );

  if (!user && !refreshPayload) {
    return unauthorizedResponse();
  }

  try {
    if (
      refreshPayload?.type === "refresh" &&
      typeof refreshPayload.familyId === "string"
    ) {
      await revokeRefreshFamily(refreshPayload.familyId);
    } else if (user) {
      await deleteRefreshSession(user.id);
    }

    const response = NextResponse.json({ ok: true });
    clearAuthCookies(response);
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    return serverErrorResponse("Log out", error);
  }
}
