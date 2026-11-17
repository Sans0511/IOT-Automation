import { NextResponse, type NextRequest } from "next/server";
import { canAccessOwner, getAuthenticatedUser } from "@/lib/api-auth";
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

export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = getAuthenticatedUser(request);

  if (!user) {
    return unauthorizedResponse();
  }

  const { id } = await params;

  if (!isObjectId(id)) {
    return badRequestResponse("Invalid farm id");
  }

  try {
    const farm = await prisma.farm.findUnique({
      where: { id },
      include: { devices: true, owner: { select: { id: true, name: true, email: true } } },
    });

    if (!farm || !canAccessOwner(user, farm.ownerId)) {
      return notFoundResponse("Farm not found");
    }

    return NextResponse.json({ farm });
  } catch (error) {
    return serverErrorResponse("Get farm", error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = getAuthenticatedUser(request);

  if (!user) {
    return unauthorizedResponse();
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

  if (name === null && location === null) {
    return badRequestResponse("Farm name or location is required");
  }

  try {
    const farm = await prisma.farm.findUnique({ where: { id } });

    if (!farm) {
      return notFoundResponse("Farm not found");
    }

    if (!canAccessOwner(user, farm.ownerId)) {
      return forbiddenResponse("You do not own this farm");
    }

    const updated = await prisma.farm.update({
      where: { id },
      data: {
        ...(name !== null ? { name } : {}),
        ...(location !== null ? { location } : {}),
      },
    });

    return NextResponse.json({ farm: updated });
  } catch (error) {
    return serverErrorResponse("Update farm", error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = getAuthenticatedUser(request);

  if (!user) {
    return unauthorizedResponse();
  }

  const { id } = await params;

  if (!isObjectId(id)) {
    return badRequestResponse("Invalid farm id");
  }

  try {
    const farm = await prisma.farm.findUnique({ where: { id } });

    if (!farm) {
      return notFoundResponse("Farm not found");
    }

    if (!canAccessOwner(user, farm.ownerId)) {
      return forbiddenResponse("You do not own this farm");
    }

    await prisma.farm.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverErrorResponse("Delete farm", error);
  }
}
