import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import {
  badRequestResponse,
  forbiddenResponse,
  isObjectId,
  readJsonBody,
  readTrimmedString,
  serverErrorResponse,
  unauthorizedResponse,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

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
  const location = readTrimmedString(body, "location");
  const ownerId = readTrimmedString(body, "ownerId");

  if (!name || !location || !ownerId) {
    return badRequestResponse("Name, location, and owner are required");
  }

  if (!isObjectId(ownerId)) {
    return badRequestResponse("Invalid owner id");
  }

  try {
    const owner = await prisma.user.findUnique({
      where: { id: ownerId },
      select: { id: true },
    });

    if (!owner) {
      return badRequestResponse("Selected owner does not exist");
    }

    const farm = await prisma.farm.create({
      data: { name, location, ownerId },
      select: {
        id: true,
        name: true,
        location: true,
        createdAt: true,
        owner: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({ farm }, { status: 201 });
  } catch (error) {
    return serverErrorResponse("Create farm", error);
  }
}
