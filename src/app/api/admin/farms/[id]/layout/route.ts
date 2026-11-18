import {
  DeviceType,
  Prisma,
  type FarmBackgroundItemRecord,
  type FarmFlowConnectionRecord,
  type FarmPlacementRecord,
  type FarmPointRecord,
} from "@prisma/client";
import { NextResponse, type NextRequest } from "next/server";
import { getAuthenticatedUser } from "@/lib/api-auth";
import {
  badRequestResponse,
  conflictResponse,
  forbiddenResponse,
  isDeviceType,
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
  FARM_DEVICE_PRESET_LABELS,
  FARM_CANVAS_WIDTH,
  FARM_LAYOUT_BACKGROUND,
  isFarmDevicePresetKey,
  parseFarmBackgroundItems,
  parseFarmConnections,
  type FarmLayoutBackgroundItem,
  type FarmLayoutConnection,
  type FarmLayoutData,
  type FarmLayoutDevice,
  type FarmLayoutPlacement,
  type FarmPoint,
} from "@/lib/farm-layout";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

type StoredFarmLayout = {
  id: string;
  farmId: string;
  width: number;
  height: number;
  backgroundKey: string;
  placements: FarmPlacementRecord[];
  backgroundItems: FarmBackgroundItemRecord[];
  connections: FarmFlowConnectionRecord[];
  version: number;
  updatedAt: Date;
};

class LayoutVersionConflict extends Error {}
class LayoutFarmNotFoundError extends Error {}
class LayoutBadRequestError extends Error {}

function toPointRecord(point: FarmPoint): Prisma.FarmPointRecordCreateInput {
  return { x: point.x, y: point.y };
}

function toFarmPoint(point: FarmPointRecord): FarmPoint {
  return { x: point.x, y: point.y };
}

function toPlacementRecord(
  placement: FarmLayoutPlacement,
): Prisma.FarmPlacementRecordCreateInput {
  return {
    deviceId: placement.deviceId,
    x: placement.x,
    y: placement.y,
    rotation: placement.rotation,
    label: placement.label ?? null,
    presetKey: placement.presetKey ?? null,
  };
}

function toBackgroundItemRecord(
  item: FarmLayoutBackgroundItem,
): Prisma.FarmBackgroundItemRecordCreateInput {
  return {
    id: item.id,
    type: item.type,
    x: item.x,
    y: item.y,
    rotation: item.rotation,
    scale: item.scale,
  };
}

function toConnectionRecord(
  connection: FarmLayoutConnection,
): Prisma.FarmFlowConnectionRecordCreateInput {
  return {
    id: connection.id,
    fromDeviceId: connection.fromDeviceId ?? null,
    fromBackgroundItemId: connection.fromBackgroundItemId ?? null,
    fromBackgroundPort: connection.fromBackgroundPort ?? null,
    fromConnectionId: connection.fromConnectionId ?? null,
    fromPoint: connection.fromPoint
      ? toPointRecord(connection.fromPoint)
      : null,
    toDeviceId: connection.toDeviceId ?? null,
    toBackgroundItemId: connection.toBackgroundItemId ?? null,
    toBackgroundPort: connection.toBackgroundPort ?? null,
    toConnectionId: connection.toConnectionId ?? null,
    toPoint: connection.toPoint ? toPointRecord(connection.toPoint) : null,
    fromPort: connection.fromPort ?? null,
    toPort: connection.toPort ?? null,
    waypoints: (connection.waypoints ?? []).map(toPointRecord),
  };
}

function connectionRecordToInput(connection: FarmFlowConnectionRecord) {
  return {
    id: connection.id,
    fromDeviceId: connection.fromDeviceId ?? undefined,
    fromBackgroundItemId: connection.fromBackgroundItemId ?? undefined,
    fromBackgroundPort: connection.fromBackgroundPort ?? undefined,
    fromConnectionId: connection.fromConnectionId ?? undefined,
    fromPoint: connection.fromPoint
      ? toFarmPoint(connection.fromPoint)
      : undefined,
    toDeviceId: connection.toDeviceId ?? undefined,
    toBackgroundItemId: connection.toBackgroundItemId ?? undefined,
    toBackgroundPort: connection.toBackgroundPort ?? undefined,
    toConnectionId: connection.toConnectionId ?? undefined,
    toPoint: connection.toPoint
      ? toFarmPoint(connection.toPoint)
      : undefined,
    fromPort: connection.fromPort ?? undefined,
    toPort: connection.toPort ?? undefined,
    waypoints: connection.waypoints.map(toFarmPoint),
  };
}

function validateLayoutForSave({
  farm,
  devices,
  placements,
  backgroundItems,
  connections,
  publish,
}: {
  farm: { id: string } | null;
  devices: { id: string }[];
  placements: FarmLayoutPlacement[];
  backgroundItems: FarmLayoutData["backgroundItems"];
  connections: FarmLayoutConnection[];
  publish: boolean;
}): Set<string> {
  if (!farm) {
    throw new LayoutFarmNotFoundError();
  }

  const allowedDeviceIds = new Set(devices.map((device) => device.id));

  for (const placement of placements) {
    if (
      !allowedDeviceIds.has(placement.deviceId) &&
      !isFarmDevicePresetKey(placement.presetKey)
    ) {
      throw new LayoutBadRequestError(
        `Device ${placement.deviceId} does not belong to this farm`,
      );
    }
  }

  if (
    publish &&
    placements.some(
      (placement) =>
        placement.presetKey && !isDeviceType(placement.presetKey),
    )
  ) {
    throw new LayoutBadRequestError("Unsupported device type in layout");
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
      throw new LayoutBadRequestError(
        "A connection references an item that is not on this layout",
      );
    }
  }

  return allowedDeviceIds;
}

function remapConnectionDeviceIds(
  connection: FarmLayoutConnection,
  deviceIdMap: Map<string, string>,
): FarmLayoutConnection {
  const next = { ...connection };

  if (next.fromDeviceId) {
    next.fromDeviceId = deviceIdMap.get(next.fromDeviceId) ?? next.fromDeviceId;
  }

  if (next.toDeviceId) {
    next.toDeviceId = deviceIdMap.get(next.toDeviceId) ?? next.toDeviceId;
  }

  return next;
}

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

function readStoredPlacements(
  value: FarmPlacementRecord[],
): FarmLayoutPlacement[] {
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
  value: FarmFlowConnectionRecord[],
  placements: FarmLayoutPlacement[],
  backgroundItemIds: Set<string>,
): FarmLayoutConnection[] {
  const placedIds = new Set(placements.map((placement) => placement.deviceId));
  const connections =
    parseFarmConnections(value.map(connectionRecordToInput)) ?? [];
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
  layout: StoredFarmLayout,
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

  const publish = body.publish === true;

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
    const { layout, publishedDeviceList, allowedDeviceIds } =
      await prisma.$transaction(async (tx) => {
        const [farm, devices] = await Promise.all([
          tx.farm.findUnique({ where: { id }, select: { id: true } }),
          tx.device.findMany({ where: { farmId: id }, select: { id: true } }),
        ]);

        const allowedDeviceIds = validateLayoutForSave({
          farm,
          devices,
          placements,
          backgroundItems,
          connections,
          publish,
        });

        const existing = await tx.farmLayout.findUnique({
          where: { farmId: id },
          select: { version: true },
        });
        const currentVersion = existing?.version ?? 0;

        if (expectedVersion !== currentVersion) {
          throw new LayoutVersionConflict();
        }

        const deviceIdMap = new Map<string, string>();
        const publishedDeviceList: FarmLayoutDevice[] = [];

        if (publish) {
          for (const placement of placements) {
            if (!placement.presetKey) {
              continue;
            }

            const existingDevice = await tx.device.findUnique({
              where: { id: placement.deviceId },
              select: { id: true },
            });

            if (existingDevice) {
              continue;
            }

            const device = await tx.device.create({
              data: {
                farmId: id,
                name:
                  placement.label ??
                  FARM_DEVICE_PRESET_LABELS[
                    placement.presetKey as keyof typeof FARM_DEVICE_PRESET_LABELS
                  ],
                type: placement.presetKey as DeviceType,
              },
              select: { id: true, name: true, type: true },
            });

            deviceIdMap.set(placement.deviceId, device.id);
            publishedDeviceList.push({
              id: device.id,
              name: device.name,
              type: device.type,
            });
          }
        }

        const publishedPlacements: FarmLayoutPlacement[] = placements.map(
          (placement) => {
            const deviceId =
              deviceIdMap.get(placement.deviceId) ?? placement.deviceId;

            if (deviceId === placement.deviceId) {
              return placement;
            }

            return {
              deviceId,
              x: placement.x,
              y: placement.y,
              rotation: placement.rotation,
              label: placement.label,
            };
          },
        );
        const publishedConnections = connections.map((connection) =>
          remapConnectionDeviceIds(connection, deviceIdMap),
        );
        const placementRecords = publishedPlacements.map(toPlacementRecord);
        const backgroundItemRecords = backgroundItems.map(
          toBackgroundItemRecord,
        );
        const connectionRecords = publishedConnections.map(toConnectionRecord);

        const layout = await tx.farmLayout.upsert({
          where: { farmId: id },
          create: {
            farmId: id,
            width: FARM_CANVAS_WIDTH,
            height: FARM_CANVAS_HEIGHT,
            backgroundKey,
            placements: placementRecords,
            backgroundItems: backgroundItemRecords,
            connections: connectionRecords,
            version: currentVersion + 1,
          },
          update: {
            width: FARM_CANVAS_WIDTH,
            height: FARM_CANVAS_HEIGHT,
            backgroundKey,
            placements: placementRecords,
            backgroundItems: backgroundItemRecords,
            connections: connectionRecords,
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

        return { layout, publishedDeviceList, allowedDeviceIds };
      });

    const responseDeviceIds = new Set([
      ...allowedDeviceIds,
      ...publishedDeviceList.map((device) => device.id),
    ]);

    return NextResponse.json({
      layout: serializeLayout(layout, responseDeviceIds),
      publishedDevices: publishedDeviceList,
    });
  } catch (error) {
    if (error instanceof LayoutVersionConflict) {
      return conflictResponse(
        "Layout was changed by another admin. Refresh and try again.",
      );
    }

    if (error instanceof LayoutFarmNotFoundError) {
      return notFoundResponse("Farm not found");
    }

    if (error instanceof LayoutBadRequestError) {
      return badRequestResponse(error.message);
    }

    return serverErrorResponse("Save farm layout", error);
  }
}
