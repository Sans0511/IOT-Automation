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
    return badRequestResponse("Invalid farm id");
  }

  const body = await readJsonBody(request);

  if (!body) {
    return badRequestResponse("A valid JSON body is required");
  }

  const name = readTrimmedString(body, "name");
  const location = readTrimmedString(body, "location");
  const ownerId = readTrimmedString(body, "ownerId");

  if (!name || !location || !ownerId) {
    return badRequestResponse("Name, location, and owner are required");
  }

  if (!isObjectId(ownerId)) {
    return badRequestResponse("Invalid owner id");
  }

  try {
    const [farm, owner] = await Promise.all([
      prisma.farm.findUnique({ where: { id }, select: { id: true } }),
      prisma.user.findUnique({ where: { id: ownerId }, select: { id: true } }),
    ]);

    if (!farm) {
      return notFoundResponse("Farm not found");
    }

    if (!owner) {
      return badRequestResponse("Selected owner does not exist");
    }

    const updated = await prisma.farm.update({
      where: { id },
      data: { name, location, ownerId },
      select: {
        id: true,
        name: true,
        location: true,
        createdAt: true,
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ farm: updated });
  } catch (error) {
    return serverErrorResponse("Update farm", error);
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
    return badRequestResponse("Invalid farm id");
  }

  try {
    const farm = await prisma.farm.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!farm) {
      return notFoundResponse("Farm not found");
    }

    await prisma.farm.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverErrorResponse("Delete farm", error);
  }
}
