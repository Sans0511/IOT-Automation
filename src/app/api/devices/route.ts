import { NextResponse, type NextRequest } from "next/server";
import { canAccessOwner, getAuthenticatedUser } from "@/lib/api-auth";
import {
  badRequestResponse,
  forbiddenResponse,
  isDeviceType,
  isObjectId,
  notFoundResponse,
  readJsonBody,
  readTrimmedString,
  serverErrorResponse,
  unauthorizedResponse,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const user = getAuthenticatedUser(request);

  if (!user) {
    return unauthorizedResponse();
  }

  const farmId = request.nextUrl.searchParams.get("farmId");

  if (farmId && !isObjectId(farmId)) {
    return badRequestResponse("Invalid farmId");
  }

  const farmFilter = user.role === "ADMIN" ? {} : { ownerId: user.id };

  try {
    const devices = await prisma.device.findMany({
      where: {
        ...(farmId ? { farmId } : {}),
        farm: farmFilter,
      },
      include: {
        farm: {
          select: { id: true, name: true, location: true, ownerId: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ devices });
  } catch (error) {
    return serverErrorResponse("List devices", error);
  }
}

export async function POST(request: NextRequest) {
  const user = getAuthenticatedUser(request);

  if (!user) {
    return unauthorizedResponse();
  }

  const body = await readJsonBody(request);

  if (!body) {
    return badRequestResponse("A valid JSON body is required");
  }

  const name = readTrimmedString(body, "name");
  const farmId = readTrimmedString(body, "farmId");
  const type = body.type;

  if (!name || !farmId || !isObjectId(farmId)) {
    return badRequestResponse("Device name and a valid farmId are required");
  }

  if (!isDeviceType(type)) {
    return badRequestResponse("Invalid device type");
  }

  try {
    const farm = await prisma.farm.findUnique({ where: { id: farmId } });

    if (!farm) {
      return notFoundResponse("Farm not found");
    }

    if (!canAccessOwner(user, farm.ownerId)) {
      return forbiddenResponse("You do not own this farm");
    }

    const device = await prisma.device.create({
      data: { name, type, farmId },
    });

    return NextResponse.json({ device }, { status: 201 });
  } catch (error) {
    return serverErrorResponse("Create device", error);
  }
}
