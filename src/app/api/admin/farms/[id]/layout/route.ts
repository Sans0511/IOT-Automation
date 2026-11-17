import { Prisma } from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import {
  badRequestResponse,
  conflictResponse,
  forbiddenResponse,
  isObjectId,
  isRecord,
  notFoundResponse,
  readJsonBody,
  serverErrorResponse,
  unauthorizedResponse,
} from "@/lib/api-helpers";
import {
  createDefaultFarmLayout,
  FARM_CANVAS_HEIGHT,
  FARM_CANVAS_WIDTH,
  FARM_LAYOUT_BACKGROUND,
  isFarmDevicePresetKey,
  parseFarmBackgroundItems,
  parseFarmConnections,
  type FarmLayoutConnection,
  type FarmLayoutData,
  type FarmLayoutPlacement,
} from "@/lib/farm-layout";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

class LayoutVersionConflict extends Error {}

function clamp(value: number, max: number): number {
  return Math.min(max, Math.max(0, Math.round(value)));
}

function normalizeRotation(value: number): number {
  const normalized = Math.round(value) % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function parsePlacements(value: unknown): FarmLayoutPlacement[] | null {
  if (!Array.isArray(value) || value.length > 500) {
    return null;
  }

  const seen = new Set<string>();
  const placements: FarmLayoutPlacement[] = [];

  for (const entry of value) {
    if (!isRecord(entry)) {
      return null;
    }

    const { deviceId, x, y, rotation, label, presetKey } = entry;
    const isPreset = isFarmDevicePresetKey(presetKey);

    if (
      typeof deviceId !== "string" ||
      !isObjectId(deviceId) ||
      seen.has(deviceId) ||
      typeof x !== "number" ||
      !Number.isFinite(x) ||
      typeof y !== "number" ||
      !Number.isFinite(y)
    ) {
      return null;
    }

    const rotationValue = rotation === undefined ? 0 : rotation;

    if (
      typeof rotationValue !== "number" ||
      !Number.isFinite(rotationValue) ||
      (label !== undefined &&
        label !== null &&
        typeof label !== "string")
    ) {
      return null;
    }

    seen.add(deviceId);
    placements.push({
      deviceId,
      x: clamp(x, FARM_CANVAS_WIDTH),
      y: clamp(y, FARM_CANVAS_HEIGHT),
      rotation: normalizeRotation(rotationValue),
      label: typeof label === "string" && label.trim() ? label.trim() : null,
      ...(isPreset ? { presetKey } : {}),
    });
  }

  return placements;
}

function readStoredPlacements(value: Prisma.JsonValue): FarmLayoutPlacement[] {
  const placements = parsePlacements(value);
  return placements ?? [];
}

function hasValidConnectionEndpoint(
  connection: FarmLayoutConnection,
  side: "from" | "to",
  placedIds: Set<string>,
  backgroundItemIds: Set<string>,
  connectionIds: Set<string>,
): boolean {
  const deviceId = side === "from" ? connection.fromDeviceId : connection.toDeviceId;
  const backgroundItemId =
    side === "from"
      ? connection.fromBackgroundItemId
      : connection.toBackgroundItemId;
  const linkedConnectionId =
    side === "from" ? connection.fromConnectionId : connection.toConnectionId;

  if (deviceId !== undefined) {
    return placedIds.has(deviceId);
  }

  if (backgroundItemId !== undefined) {
    return backgroundItemIds.has(backgroundItemId);
  }

  if (linkedConnectionId !== undefined) {
    return (
      linkedConnectionId !== connection.id &&
      connectionIds.has(linkedConnectionId)
    );
  }

  return true;
}

function readStoredConnections(
  value: Prisma.JsonValue | null,
  placements: FarmLayoutPlacement[],
  backgroundItemIds: Set<string>,
): FarmLayoutConnection[] {
  const placedIds = new Set(placements.map((placement) => placement.deviceId));
  const connections = parseFarmConnections(value) ?? [];
  const connectionIds = new Set(connections.map((connection) => connection.id));

  return connections.filter(
    (connection) =>
      hasValidConnectionEndpoint(
        connection,
        "from",
        placedIds,
        backgroundItemIds,
        connectionIds,
      ) &&
      hasValidConnectionEndpoint(
        connection,
        "to",
        placedIds,
        backgroundItemIds,
        connectionIds,
      ),
  );
}

function serializeLayout(
  layout: {
    id: string;
    farmId: string;
    width: number;
    height: number;
    backgroundKey: string;
    placements: Prisma.JsonValue;
    backgroundItems: Prisma.JsonValue | null;
    connections: Prisma.JsonValue | null;
    version: number;
    updatedAt: Date;
  },
  allowedDeviceIds: Set<string>,
): FarmLayoutData {
  const placements = readStoredPlacements(layout.placements).filter(
    (placement) =>
      allowedDeviceIds.has(placement.deviceId) ||
      isFarmDevicePresetKey(placement.presetKey),
  );
  const backgroundItems = parseFarmBackgroundItems(layout.backgroundItems) ?? [];

  return {
    id: layout.id,
    farmId: layout.farmId,
    width: layout.width,
    height: layout.height,
    backgroundKey: layout.backgroundKey,
    placements,
    backgroundItems,
    connections: readStoredConnections(
      layout.connections,
      placements,
      new Set(backgroundItems.map((item) => item.id)),
    ),
    version: layout.version,
    updatedAt: layout.updatedAt.toISOString(),
  };
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const user = getAuthenticatedUser(request);

  if (!user) {
    return unauthorizedResponse();
  }

  if (user.role !== "ADMIN") {
    return forbiddenResponse("Admin access required");
  }

  const { id } = await params;

  if (!isObjectId(id)) {
    return badRequestResponse("Invalid farm id");
  }

  try {
    const [farm, devices, layout] = await Promise.all([
      prisma.farm.findUnique({ where: { id }, select: { id: true } }),
      prisma.device.findMany({ where: { farmId: id }, select: { id: true } }),
      prisma.farmLayout.findUnique({ where: { farmId: id } }),
    ]);

    if (!farm) {
      return notFoundResponse("Farm not found");
    }

    const allowedDeviceIds = new Set(devices.map((device) => device.id));

    if (!layout) {
      return NextResponse.json({ layout: createDefaultFarmLayout(id) });
    }

    return NextResponse.json({
      layout: serializeLayout(layout, allowedDeviceIds),
    });
  } catch (error) {
    return serverErrorResponse("Load farm layout", error);
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  const user = getAuthenticatedUser(request);

  if (!user) {
    return unauthorizedResponse();
  }

  if (user.role !== "ADMIN") {
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

  const placements = parsePlacements(body.placements);

  if (!placements) {
    return badRequestResponse("Invalid layout placements");
  }

  const backgroundItems = parseFarmBackgroundItems(
    body.backgroundItems ?? [],
  );

  if (!backgroundItems) {
    return badRequestResponse("Invalid background items");
  }

  const connections = parseFarmConnections(body.connections ?? []);

  if (!connections) {
    return badRequestResponse("Invalid device connections");
  }

  const expectedVersion = body.version;

  if (
    typeof expectedVersion !== "number" ||
    !Number.isInteger(expectedVersion) ||
    expectedVersion < 0
  ) {
    return badRequestResponse("Invalid layout version");
  }

  const backgroundKey = body.backgroundKey ?? FARM_LAYOUT_BACKGROUND;

  if (backgroundKey !== FARM_LAYOUT_BACKGROUND) {
    return badRequestResponse("Unsupported farm background");
  }

  try {
    const [farm, devices] = await Promise.all([
      prisma.farm.findUnique({ where: { id }, select: { id: true } }),
      prisma.device.findMany({ where: { farmId: id }, select: { id: true } }),
    ]);

    if (!farm) {
      return notFoundResponse("Farm not found");
    }

    const allowedDeviceIds = new Set(devices.map((device) => device.id));

    for (const placement of placements) {
      if (
        !allowedDeviceIds.has(placement.deviceId) &&
        !isFarmDevicePresetKey(placement.presetKey)
      ) {
        return badRequestResponse(
          `Device ${placement.deviceId} does not belong to this farm`,
        );
      }
    }

    const placedIds = new Set(placements.map((placement) => placement.deviceId));
    const backgroundItemIds = new Set(
      backgroundItems.map((item) => item.id),
    );
    const connectionIds = new Set(connections.map((connection) => connection.id));

    for (const connection of connections) {
      if (
        !hasValidConnectionEndpoint(
          connection,
          "from",
          placedIds,
          backgroundItemIds,
          connectionIds,
        ) ||
        !hasValidConnectionEndpoint(
          connection,
          "to",
          placedIds,
          backgroundItemIds,
          connectionIds,
        )
      ) {
        return badRequestResponse(
          "A connection references an item that is not on this layout",
        );
      }
    }

    const layout = await prisma.$transaction(async (tx) => {
      const existing = await tx.farmLayout.findUnique({
        where: { farmId: id },
        select: { version: true },
      });
      const currentVersion = existing?.version ?? 0;

      if (expectedVersion !== currentVersion) {
        throw new LayoutVersionConflict();
      }

      return tx.farmLayout.upsert({
        where: { farmId: id },
        create: {
          farmId: id,
          width: FARM_CANVAS_WIDTH,
          height: FARM_CANVAS_HEIGHT,
          backgroundKey,
          placements: placements as unknown as Prisma.InputJsonValue,
          backgroundItems: backgroundItems as unknown as Prisma.InputJsonValue,
          connections: connections as unknown as Prisma.InputJsonValue,
          version: currentVersion + 1,
        },
        update: {
          width: FARM_CANVAS_WIDTH,
          height: FARM_CANVAS_HEIGHT,
          backgroundKey,
          placements: placements as unknown as Prisma.InputJsonValue,
          backgroundItems: backgroundItems as unknown as Prisma.InputJsonValue,
          connections: connections as unknown as Prisma.InputJsonValue,
          version: { increment: 1 },
        },
        select: {
          id: true,
          farmId: true,
          width: true,
          height: true,
          backgroundKey: true,
          placements: true,
          backgroundItems: true,
          connections: true,
          version: true,
          updatedAt: true,
        },
      });
    });

    return NextResponse.json({
      layout: serializeLayout(layout, allowedDeviceIds),
    });
  } catch (error) {
    if (error instanceof LayoutVersionConflict) {
      return conflictResponse(
        "Layout was changed by another admin. Refresh and try again.",
      );
    }

    return serverErrorResponse("Save farm layout", error);
  }
}
