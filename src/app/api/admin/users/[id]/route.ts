import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import {
  badRequestResponse,
  forbiddenResponse,
  isObjectId,
  notFoundResponse,
  readJsonBody,
  readTrimmedString,
  serverErrorResponse,
  unauthorizedResponse,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isRole(value: unknown): value is "ADMIN" | "USER" {
  return value === "ADMIN" || value === "USER";
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const actor = getAuthenticatedUser(request);

  if (!actor) {
    return unauthorizedResponse();
  }

  if (actor.role !== "ADMIN") {
    return forbiddenResponse("Admin access required");
  }

  const { id } = await params;

  if (!isObjectId(id)) {
    return badRequestResponse("Invalid user id");
  }

  const body = await readJsonBody(request);

  if (!body) {
    return badRequestResponse("A valid JSON body is required");
  }

  const name = readTrimmedString(body, "name");
  const rawEmail = readTrimmedString(body, "email");
  const email = rawEmail?.toLowerCase() ?? null;
  const role = body.role;

  if (!name || !email || !EMAIL_PATTERN.test(email)) {
    return badRequestResponse("A valid name and email are required");
  }

  if (!isRole(role)) {
    return badRequestResponse("Role must be ADMIN or USER");
  }

  if (id === actor.id && role !== "ADMIN") {
    return badRequestResponse("You cannot remove your own admin role");
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });

    if (!user) {
      return notFoundResponse("User not found");
    }

    const [duplicateEmail, adminCount] = await Promise.all([
      prisma.user.findFirst({
        where: { email, NOT: { id } },
        select: { id: true },
      }),
      prisma.user.count({ where: { role: "ADMIN" } }),
    ]);

    if (duplicateEmail) {
      return badRequestResponse("A user with that email already exists");
    }

    if (user.role === "ADMIN" && role === "USER" && adminCount <= 1) {
      return badRequestResponse("At least one admin account is required");
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { name, email, role },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ user: updated });
  } catch (error) {
    return serverErrorResponse("Update user", error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const actor = getAuthenticatedUser(request);

  if (!actor) {
    return unauthorizedResponse();
  }

  if (actor.role !== "ADMIN") {
    return forbiddenResponse("Admin access required");
  }

  const { id } = await params;

  if (!isObjectId(id)) {
    return badRequestResponse("Invalid user id");
  }

  if (id === actor.id) {
    return badRequestResponse("You cannot delete your own account");
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true },
    });

    if (!user) {
      return notFoundResponse("User not found");
    }

    if (user.role === "ADMIN") {
      const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });

      if (adminCount <= 1) {
        return badRequestResponse("At least one admin account is required");
      }
    }

    await prisma.user.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverErrorResponse("Delete user", error);
  }
}
