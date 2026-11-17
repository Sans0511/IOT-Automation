import { Prisma, type Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import {
  badRequestResponse,
  forbiddenResponse,
  readJsonBody,
  readTrimmedString,
  serverErrorResponse,
  unauthorizedResponse,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isRole(value: unknown): value is Role {
  return value === "ADMIN" || value === "USER";
}

export async function POST(request: NextRequest) {
  const actor = getAuthenticatedUser(request);

  if (!actor) {
    return unauthorizedResponse();
  }

  if (actor.role !== "ADMIN") {
    return forbiddenResponse("Admin access required");
  }

  const body = await readJsonBody(request);

  if (!body) {
    return badRequestResponse("A valid JSON body is required");
  }

  const name = readTrimmedString(body, "name");
  const rawEmail = readTrimmedString(body, "email");
  const password = body.password;
  const email = rawEmail?.toLowerCase() ?? null;
  const requestedRole = body.role ?? "USER";

  if (!name || !email || !EMAIL_PATTERN.test(email)) {
    return badRequestResponse("A valid name and email are required");
  }

  if (typeof password !== "string" || password.length < 8) {
    return badRequestResponse("Password must be at least 8 characters");
  }

  if (!isRole(requestedRole)) {
    return badRequestResponse("Role must be ADMIN or USER");
  }

  try {
    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      return NextResponse.json(
        { error: "A user with that email already exists" },
        { status: 409 },
      );
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: await bcrypt.hash(password, 12),
        role: requestedRole,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return NextResponse.json(
        { error: "A user with that email already exists" },
        { status: 409 },
      );
    }

    return serverErrorResponse("Register user", error);
  }
}
