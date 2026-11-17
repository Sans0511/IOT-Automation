import type { Prisma } from "@prisma/client";
import {
  FARM_CANVAS_HEIGHT,
  FARM_CANVAS_WIDTH,
  FARM_LAYOUT_BACKGROUND,
  isFarmDevicePresetKey,
  parseFarmBackgroundItems,
  parseFarmConnections,
  type FarmLayoutConnection,
  type FarmLayoutData,
  type FarmLayoutDevice,
  type FarmLayoutPlacement,
} from "@/lib/farm-layout";
import { prisma } from "@/lib/prisma";
import { isObjectId, isRecord } from "@/lib/api-helpers";

export type PublishedFarm = {
  id: string;
  name: string;
  location: string;
  devices: FarmLayoutDevice[];
  layout: FarmLayoutData;
};

type StoredLayout = {
  id: string;
  farmId: string;
  width: number;
  height: number;
  backgroundKey: string;
  placements: Prisma.JsonValue;
  backgroundItems: Prisma.JsonValue;
  connections: Prisma.JsonValue;
  version: number;
  updatedAt: Date;
};

function clamp(value: number, max: number): number {
  return Math.min(max, Math.max(0, Math.round(value)));
}

function normalizeRotation(value: number): number {
  const normalized = Math.round(value) % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function parsePlacements(value: Prisma.JsonValue): FarmLayoutPlacement[] {
  if (!Array.isArray(value) || value.length > 500) {
    return [];
  }

  const seen = new Set<string>();
  const placements: FarmLayoutPlacement[] = [];

  for (const entry of value) {
    if (!isRecord(entry)) {
      continue;
    }

    const { deviceId, x, y, rotation, label, presetKey } = entry;
    const rotationValue = rotation === undefined ? 0 : rotation;

    if (
      typeof deviceId !== "string" ||
      !isObjectId(deviceId) ||
      seen.has(deviceId) ||
      typeof x !== "number" ||
      !Number.isFinite(x) ||
      typeof y !== "number" ||
      !Number.isFinite(y) ||
      typeof rotationValue !== "number" ||
      !Number.isFinite(rotationValue) ||
      (label !== undefined &&
        label !== null &&
        typeof label !== "string")
    ) {
      continue;
    }

    seen.add(deviceId);
    placements.push({
      deviceId,
      x: clamp(x, FARM_CANVAS_WIDTH),
      y: clamp(y, FARM_CANVAS_HEIGHT),
      rotation: normalizeRotation(rotationValue),
      label: typeof label === "string" && label.trim() ? label.trim() : null,
      ...(isFarmDevicePresetKey(presetKey) ? { presetKey } : {}),
    });
  }

  return placements;
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
  value: Prisma.JsonValue,
  placements: FarmLayoutPlacement[],
  backgroundItems: FarmLayoutData["backgroundItems"],
): FarmLayoutConnection[] {
  const connections = parseFarmConnections(value) ?? [];
  const placedIds = new Set(placements.map((placement) => placement.deviceId));
  const backgroundItemIds = new Set(backgroundItems.map((item) => item.id));
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

function serializeLayout(layout: StoredLayout): FarmLayoutData {
  const placements = parsePlacements(layout.placements);
  const backgroundItems = parseFarmBackgroundItems(layout.backgroundItems) ?? [];

  return {
    id: layout.id,
    farmId: layout.farmId,
    width: layout.width > 0 ? layout.width : FARM_CANVAS_WIDTH,
    height: layout.height > 0 ? layout.height : FARM_CANVAS_HEIGHT,
    backgroundKey: layout.backgroundKey || FARM_LAYOUT_BACKGROUND,
    placements,
    backgroundItems,
    connections: readStoredConnections(
      layout.connections,
      placements,
      backgroundItems,
    ),
    version: layout.version,
    updatedAt: layout.updatedAt.toISOString(),
  };
}

export async function getPublishedLayoutsByEmail(email: string): Promise<{
  email: string;
  farms: PublishedFarm[];
} | null> {
  const account = await prisma.user.findFirst({
    where: {
      email: { equals: email, mode: "insensitive" },
    },
    select: {
      email: true,
      farms: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          name: true,
          location: true,
          devices: {
            orderBy: { createdAt: "asc" },
            select: { id: true, name: true, type: true },
          },
          layout: true,
        },
      },
    },
  });

  if (!account) {
    return null;
  }

  const farms = account.farms
    .filter((farm) => farm.layout !== null)
    .map((farm) => ({
      id: farm.id,
      name: farm.name,
      location: farm.location,
      devices: farm.devices,
      layout: serializeLayout(farm.layout as StoredLayout),
    }));

  return { email: account.email, farms };
}
