import { NextResponse, type NextRequest } from "next/server";
import {
  ACCESS_AUDIENCE,
  ACCESS_TOKEN_MAX_AGE_SECONDS,
  type AccessTokenPayload,
  verifyToken,
} from "@/lib/jwt";

const ACCESS_TOKEN_COOKIE = "access_token";

function isAuthenticated(request: NextRequest): boolean {
  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? "";
  const payload = verifyToken<AccessTokenPayload>(
    token,
    process.env.JWT_ACCESS_SECRET,
    ACCESS_AUDIENCE,
    ACCESS_TOKEN_MAX_AGE_SECONDS,
  );

  return (
    payload?.type === "access" &&
    typeof payload.sub === "string" &&
    typeof payload.email === "string" &&
    (payload.role === "ADMIN" || payload.role === "USER")
  );
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const authenticated = isAuthenticated(request);

  if (pathname === "/login" && authenticated) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (pathname === "/" && !authenticated) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/", "/login"],
};
