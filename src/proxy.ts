import jwt from "jsonwebtoken";
import { NextResponse, type NextRequest } from "next/server";

const ACCESS_TOKEN_COOKIE = "access_token";

function isAuthenticated(request: NextRequest): boolean {
  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
  const secret = process.env.JWT_ACCESS_SECRET;

  if (!token || !secret) {
    return false;
  }

  try {
    const payload = jwt.verify(token, secret);

    return (
      typeof payload === "object" &&
      payload.type === "access" &&
      typeof payload.sub === "string"
    );
  } catch {
    return false;
  }
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
