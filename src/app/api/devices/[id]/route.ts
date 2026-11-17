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
    return badRequestResponse("Invalid device id");
  }

  try {
    const device = await prisma.device.findUnique({
      where: { id },
      include: {
        farm: {
          select: { id: true, name: true, location: true, ownerId: true },
        },
      },
    });

    if (!device || !canAccessOwner(user, device.farm.ownerId)) {
      return notFoundResponse("Device not found");
    }

    return NextResponse.json({ device });
  } catch (error) {
    return serverErrorResponse("Get device", error);
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = getAuthenticatedUser(request);

  if (!user) {
    return unauthorizedResponse();
  }

  const { id } = await params;

  if (!isObjectId(id)) {
    return badRequestResponse("Invalid device id");
  }

  const body = await readJsonBody(request);

  if (!body) {
    return badRequestResponse("A valid JSON body is required");
  }

  const hasName = Object.prototype.hasOwnProperty.call(body, "name");
  const hasType = Object.prototype.hasOwnProperty.call(body, "type");
  const hasFarmId = Object.prototype.hasOwnProperty.call(body, "farmId");

  const name = hasName ? readTrimmedString(body, "name") : null;
  const farmId = hasFarmId ? readTrimmedString(body, "farmId") : null;
  const deviceType = isDeviceType(body.type) ? body.type : null;

  if (!hasName && !hasType && !hasFarmId) {
    return badRequestResponse("Device name, type, or farmId is required");
  }

  if (hasName && !name) {
    return badRequestResponse("Device name cannot be empty");
  }

  if (hasType && !deviceType) {
    return badRequestResponse("Invalid device type");
  }

  if (hasFarmId && (!farmId || !isObjectId(farmId))) {
    return badRequestResponse("Invalid farmId");
  }

  try {
    const device = await prisma.device.findUnique({
      where: { id },
      include: { farm: { select: { ownerId: true } } },
    });

    if (!device) {
      return notFoundResponse("Device not found");
    }

    if (!canAccessOwner(user, device.farm.ownerId)) {
      return forbiddenResponse("You do not own this device");
    }

    if (farmId) {
      const targetFarm = await prisma.farm.findUnique({ where: { id: farmId } });

      if (!targetFarm) {
        return notFoundResponse("Farm not found");
      }

      if (!canAccessOwner(user, targetFarm.ownerId)) {
        return forbiddenResponse("You do not own the target farm");
      }
    }

    const updated = await prisma.device.update({
      where: { id },
      data: {
        ...(name ? { name } : {}),
        ...(deviceType ? { type: deviceType } : {}),
        ...(farmId ? { farmId } : {}),
      },
    });

    return NextResponse.json({ device: updated });
  } catch (error) {
    return serverErrorResponse("Update device", error);
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = getAuthenticatedUser(request);

  if (!user) {
    return unauthorizedResponse();
  }

  const { id } = await params;

  if (!isObjectId(id)) {
    return badRequestResponse("Invalid device id");
  }

  try {
    const device = await prisma.device.findUnique({
      where: { id },
      include: { farm: { select: { ownerId: true } } },
    });

    if (!device) {
      return notFoundResponse("Device not found");
    }

    if (!canAccessOwner(user, device.farm.ownerId)) {
      return forbiddenResponse("You do not own this device");
    }

    await prisma.device.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    return serverErrorResponse("Delete device", error);
  }
}
