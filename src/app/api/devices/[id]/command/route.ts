import { NextResponse, type NextRequest } from "next/server";
import { canAccessOwner, getAuthenticatedUser } from "@/lib/api-auth";
import { isControllableDeviceType } from "@/lib/device-control";
import {
  badRequestResponse,
  isObjectId,
  notFoundResponse,
  readJsonBody,
  readTrimmedString,
  serverErrorResponse,
  unauthorizedResponse,
} from "@/lib/api-helpers";
import { sendDeviceCommand } from "@/lib/mqttClient";
import { prisma } from "@/lib/prisma";
import { cacheDeviceStatus, publishDeviceStatus } from "@/lib/redis";
import { COMMAND_STATUS_FRESH_MS, millisecondsToSeconds } from "@/lib/freshness";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const COMMANDS = new Set(["ON", "OFF"]);

export async function POST(request: NextRequest, { params }: RouteParams) {
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

  const rawCommand = readTrimmedString(body, "command");

  if (!rawCommand || !COMMANDS.has(rawCommand.toUpperCase())) {
    return badRequestResponse("Command must be ON or OFF");
  }

  const command = rawCommand.toUpperCase() as "ON" | "OFF";

  try {
    const device = await prisma.device.findUnique({
      where: { id },
      include: {
        farm: {
          select: { id: true, ownerId: true },
        },
      },
    });

    if (!device || !canAccessOwner(user, device.farm.ownerId)) {
      return notFoundResponse("Device not found");
    }

    if (!isControllableDeviceType(device.type)) {
      return badRequestResponse("This device cannot be switched on or off");
    }

    await sendDeviceCommand(device.farm.id, device.id, { state: command });

    const isValve = device.type === "SOLENOID_VALVE" || device.type === "VALVE";
    const statusEnvelope = {
      farmId: device.farm.id,
      deviceId: device.id,
      kind: "status" as const,
      payload: {
        state: "ONLINE",
        source: "command",
        [isValve ? "valveOpen" : "pumpOn"]: command === "ON",
      },
      topic: `farm/${device.farm.id}/device/${device.id}/status`,
      receivedAt: new Date().toISOString(),
    };

    await cacheDeviceStatus(
      statusEnvelope,
      millisecondsToSeconds(COMMAND_STATUS_FRESH_MS),
    );
    await publishDeviceStatus(statusEnvelope);

    return NextResponse.json({
      deviceId: device.id,
      command,
    });
  } catch (error) {
    return serverErrorResponse("Send device command", error);
  }
}
