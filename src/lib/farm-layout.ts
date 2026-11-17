export const FARM_CANVAS_WIDTH = 1200;
export const FARM_CANVAS_HEIGHT = 800;
export const FARM_LAYOUT_BACKGROUND = "classic-farm";
export const FARM_LAYOUT_GRID = 20;
export const BACKGROUND_ITEM_DRAG_TYPE = "application/x-farm-background-item";
export const DEVICE_PRESET_DRAG_TYPE = "application/x-farm-device-preset";
export const FARM_DEVICE_PORT_OFFSET = 30;

export const FARM_BACKGROUND_ITEM_TYPES = [
  "TREE",
  "APPLE_TREE",
  "MANGO_TREE",
  "ROSE_PLANT",
  "WATER_TANK",
  "POND",
  "SHED",
  "FLOWER_BED",
] as const;

export type FarmBackgroundItemType =
  (typeof FARM_BACKGROUND_ITEM_TYPES)[number];

export type FarmLayoutBackgroundItem = {
  id: string;
  type: FarmBackgroundItemType;
  x: number;
  y: number;
  rotation: number;
  scale: number;
};

export const FARM_DEVICE_PRESET_LABELS = {
  WATER_TANK: "Water Tank",
  MOTOR_PUMP: "Motor Pump",
  SOLENOID_VALVE: "Solenoid Valve",
  MOISTURE_SENSOR: "Moisture Sensor",
  RAIN_DETECTION: "Rain Detection",
  SPRINKLER_LINE: "Sprinkler Line",
  SMART_IRRIGATION_CONTROLLER: "Smart Irrigation Controller",
  DELIVERY_POINT: "Delivery Point",
} as const;

export type FarmDevicePresetKey = keyof typeof FARM_DEVICE_PRESET_LABELS;

export type FarmDevicePort = "inlet" | "outlet";

export const FARM_DEVICE_PORT_LABELS: Record<FarmDevicePort, string> = {
  inlet: "Incoming",
  outlet: "Delivery",
};

export const FARM_DEVICE_PRESETS = (
  Object.keys(FARM_DEVICE_PRESET_LABELS) as FarmDevicePresetKey[]
).map((key) => ({ key, name: FARM_DEVICE_PRESET_LABELS[key] }));

export type FarmLayoutPlacement = {
  deviceId: string;
  x: number;
  y: number;
  rotation: number;
  label: string | null;
  presetKey?: FarmDevicePresetKey;
};

export type FarmPoint = { x: number; y: number };

export type FarmFlowEndpointRef =
  | { kind: "device"; deviceId: string; port?: FarmDevicePort }
  | { kind: "backgroundItem"; backgroundItemId: string }
  | { kind: "connection"; connectionId: string; point: FarmPoint }
  | { kind: "point"; point: FarmPoint };

export type FarmLayoutConnection = {
  id: string;
  fromDeviceId?: string;
  fromBackgroundItemId?: string;
  fromConnectionId?: string;
  fromPoint?: FarmPoint;
  toDeviceId?: string;
  toBackgroundItemId?: string;
  toConnectionId?: string;
  toPoint?: FarmPoint;
  fromPort?: FarmDevicePort;
  toPort?: FarmDevicePort;
  waypoints?: FarmPoint[];
};

export type FarmLayoutData = {
  id: string | null;
  farmId: string;
  width: number;
  height: number;
  backgroundKey: string;
  placements: FarmLayoutPlacement[];
  backgroundItems: FarmLayoutBackgroundItem[];
  connections: FarmLayoutConnection[];
  version: number;
  updatedAt: string | null;
};

export type FarmLayoutDevice = {
  id: string;
  name: string;
  type: string;
};

export const DEVICE_TYPE_LABELS: Record<string, string> = {
  VALVE: "Valve",
  PUMP: "Pump",
  WEATHER_STATION: "Weather station",
  ...FARM_DEVICE_PRESET_LABELS,
};

export const FARM_BACKGROUND_LABELS: Record<FarmBackgroundItemType, string> = {
  TREE: "Tree",
  APPLE_TREE: "Apple tree",
  MANGO_TREE: "Mango tree",
  ROSE_PLANT: "Rose plant",
  WATER_TANK: "Water tank",
  POND: "Pond",
  SHED: "Shed",
  FLOWER_BED: "Flower bed",
};

function clamp(value: number, max: number): number {
  return Math.min(max, Math.max(0, Math.round(value)));
}

function normalizeRotation(value: number): number {
  const normalized = Math.round(value) % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isBackgroundItemType(
  value: unknown,
): value is FarmBackgroundItemType {
  return (
    typeof value === "string" &&
    FARM_BACKGROUND_ITEM_TYPES.includes(value as FarmBackgroundItemType)
  );
}

export function createDefaultFarmLayout(farmId: string): FarmLayoutData {
  return {
    id: null,
    farmId,
    width: FARM_CANVAS_WIDTH,
    height: FARM_CANVAS_HEIGHT,
    backgroundKey: FARM_LAYOUT_BACKGROUND,
    placements: [],
    backgroundItems: [],
    connections: [],
    version: 0,
    updatedAt: null,
  };
}

export function createFarmPlacement(
  deviceId: string,
  x: number,
  y: number,
  presetKey?: FarmDevicePresetKey,
): FarmLayoutPlacement {
  return {
    deviceId,
    x: Math.round(x),
    y: Math.round(y),
    rotation: 0,
    label: null,
    ...(presetKey ? { presetKey } : {}),
  };
}

function copyPoint(point: FarmPoint): FarmPoint {
  return { x: Math.round(point.x), y: Math.round(point.y) };
}

export function createFarmFlowConnection(
  from: FarmFlowEndpointRef,
  to: FarmFlowEndpointRef,
  waypoints: FarmPoint[] = [],
): FarmLayoutConnection {
  const connection: FarmLayoutConnection = { id: crypto.randomUUID() };

  if (from.kind === "device") {
    connection.fromDeviceId = from.deviceId;
    if (from.port) {
      connection.fromPort = from.port;
    }
  } else if (from.kind === "backgroundItem") {
    connection.fromBackgroundItemId = from.backgroundItemId;
  } else if (from.kind === "connection") {
    connection.fromConnectionId = from.connectionId;
    connection.fromPoint = copyPoint(from.point);
  } else {
    connection.fromPoint = copyPoint(from.point);
  }

  if (to.kind === "device") {
    connection.toDeviceId = to.deviceId;
    if (to.port) {
      connection.toPort = to.port;
    }
  } else if (to.kind === "backgroundItem") {
    connection.toBackgroundItemId = to.backgroundItemId;
  } else if (to.kind === "connection") {
    connection.toConnectionId = to.connectionId;
    connection.toPoint = copyPoint(to.point);
  } else {
    connection.toPoint = copyPoint(to.point);
  }

  if (waypoints.length > 0) {
    connection.waypoints = waypoints.map(copyPoint);
  }

  return connection;
}

export function createFarmConnection(
  fromDeviceId: string,
  toDeviceId: string,
  fromPort?: FarmDevicePort,
  toPort?: FarmDevicePort,
): FarmLayoutConnection {
  return createFarmFlowConnection(
    { kind: "device", deviceId: fromDeviceId, ...(fromPort ? { port: fromPort } : {}) },
    { kind: "device", deviceId: toDeviceId, ...(toPort ? { port: toPort } : {}) },
  );
}

export function createFarmBackgroundConnection(
  fromDeviceId: string,
  toBackgroundItemId: string,
  fromPort?: FarmDevicePort,
): FarmLayoutConnection {
  return createFarmFlowConnection(
    { kind: "device", deviceId: fromDeviceId, ...(fromPort ? { port: fromPort } : {}) },
    { kind: "backgroundItem", backgroundItemId: toBackgroundItemId },
  );
}

function isFarmDevicePort(value: unknown): value is FarmDevicePort {
  return value === "inlet" || value === "outlet";
}

export function isFarmDevicePresetKey(
  value: unknown,
): value is FarmDevicePresetKey {
  return (
    typeof value === "string" &&
    FARM_DEVICE_PRESETS.some((preset) => preset.key === value)
  );
}

export function createPresetDeviceId(): string {
  return crypto.randomUUID().replace(/-/g, "").slice(0, 24);
}

export function createPresetDevice(
  id: string,
  presetKey: FarmDevicePresetKey,
): FarmLayoutDevice {
  return { id, name: FARM_DEVICE_PRESET_LABELS[presetKey], type: presetKey };
}

export function derivePresetDevices(
  placements: FarmLayoutPlacement[],
  devices: FarmLayoutDevice[],
): FarmLayoutDevice[] {
  const knownIds = new Set(devices.map((device) => device.id));
  const seen = new Set<string>();
  const presetDevices: FarmLayoutDevice[] = [];

  for (const placement of placements) {
    if (
      !placement.presetKey ||
      knownIds.has(placement.deviceId) ||
      seen.has(placement.deviceId)
    ) {
      continue;
    }

    seen.add(placement.deviceId);
    presetDevices.push(
      createPresetDevice(placement.deviceId, placement.presetKey),
    );
  }

  return presetDevices;
}

export function createFarmBackgroundItem(
  type: FarmBackgroundItemType,
  x: number,
  y: number,
): FarmLayoutBackgroundItem {
  return {
    id: crypto.randomUUID(),
    type,
    x: Math.round(x),
    y: Math.round(y),
    rotation: 0,
    scale: 1,
  };
}

export function parseFarmBackgroundItems(
  value: unknown,
): FarmLayoutBackgroundItem[] | null {
  if (!Array.isArray(value) || value.length > 200) {
    return null;
  }

  const seen = new Set<string>();
  const items: FarmLayoutBackgroundItem[] = [];

  for (const entry of value) {
    if (!isRecord(entry)) {
      return null;
    }

    const { id, type, x, y, rotation, scale } = entry;
    const rotationValue = rotation === undefined ? 0 : rotation;
    const scaleValue = scale === undefined ? 1 : scale;

    if (
      typeof id !== "string" ||
      !id.trim() ||
      id.length > 100 ||
      seen.has(id) ||
      !isBackgroundItemType(type) ||
      typeof x !== "number" ||
      !Number.isFinite(x) ||
      typeof y !== "number" ||
      !Number.isFinite(y) ||
      typeof rotationValue !== "number" ||
      !Number.isFinite(rotationValue) ||
      typeof scaleValue !== "number" ||
      !Number.isFinite(scaleValue) ||
      scaleValue < 0.5 ||
      scaleValue > 2
    ) {
      return null;
    }

    seen.add(id);
    items.push({
      id,
      type,
      x: clamp(x, FARM_CANVAS_WIDTH),
      y: clamp(y, FARM_CANVAS_HEIGHT),
      rotation: normalizeRotation(rotationValue),
      scale: Number(scaleValue.toFixed(2)),
    });
  }

  return items;
}

function hasId(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseFlowPoint(value: unknown): FarmPoint | null {
  if (!isRecord(value)) {
    return null;
  }

  const { x, y } = value;

  if (
    typeof x !== "number" ||
    !Number.isFinite(x) ||
    typeof y !== "number" ||
    !Number.isFinite(y)
  ) {
    return null;
  }

  return { x: clamp(x, FARM_CANVAS_WIDTH), y: clamp(y, FARM_CANVAS_HEIGHT) };
}

export function parseFarmConnections(
  value: unknown,
): FarmLayoutConnection[] | null {
  if (value === undefined || value === null) {
    return [];
  }

  if (!Array.isArray(value) || value.length > 500) {
    return null;
  }

  const seen = new Set<string>();
  const connections: FarmLayoutConnection[] = [];

  for (const entry of value) {
    if (!isRecord(entry)) {
      return null;
    }

    const {
      id,
      fromDeviceId,
      fromBackgroundItemId,
      fromConnectionId,
      fromPoint,
      toDeviceId,
      toBackgroundItemId,
      toConnectionId,
      toPoint,
      fromPort,
      toPort,
      waypoints,
    } = entry;

    if (
      typeof id !== "string" ||
      !id.trim() ||
      id.length > 100 ||
      seen.has(id)
    ) {
      return null;
    }

    const sourceKinds = [
      hasId(fromDeviceId) ? "device" : null,
      hasId(fromBackgroundItemId) ? "background" : null,
      hasId(fromConnectionId) ? "connection" : null,
      fromPoint !== undefined ? "point" : null,
    ].filter(Boolean);
    const targetKinds = [
      hasId(toDeviceId) ? "device" : null,
      hasId(toBackgroundItemId) ? "background" : null,
      hasId(toConnectionId) ? "connection" : null,
      toPoint !== undefined ? "point" : null,
    ].filter(Boolean);

    if (sourceKinds.length !== 1 || targetKinds.length !== 1) {
      return null;
    }

    const parsedFromPoint = fromPoint === undefined ? null : parseFlowPoint(fromPoint);
    const parsedToPoint = toPoint === undefined ? null : parseFlowPoint(toPoint);

    if (
      (fromPoint !== undefined && !parsedFromPoint) ||
      (toPoint !== undefined && !parsedToPoint) ||
      (hasId(fromConnectionId) && !parsedFromPoint) ||
      (hasId(toConnectionId) && !parsedToPoint) ||
      (fromPort !== undefined && !isFarmDevicePort(fromPort)) ||
      (toPort !== undefined && !isFarmDevicePort(toPort)) ||
      (sourceKinds[0] !== "device" && fromPort !== undefined) ||
      (targetKinds[0] !== "device" && toPort !== undefined) ||
      (hasId(fromDeviceId) && hasId(toDeviceId) && fromDeviceId === toDeviceId) ||
      (hasId(fromConnectionId) && fromConnectionId === id) ||
      (hasId(toConnectionId) && toConnectionId === id)
    ) {
      return null;
    }

    let parsedWaypoints: FarmPoint[] | undefined;

    if (waypoints !== undefined) {
      if (!Array.isArray(waypoints) || waypoints.length > 200) {
        return null;
      }

      parsedWaypoints = [];

      for (const waypoint of waypoints) {
        const parsed = parseFlowPoint(waypoint);
        if (!parsed) {
          return null;
        }
        parsedWaypoints.push(parsed);
      }
    }

    const connection: FarmLayoutConnection = { id };

    if (hasId(fromDeviceId)) {
      connection.fromDeviceId = fromDeviceId;
    }
    if (hasId(fromBackgroundItemId)) {
      connection.fromBackgroundItemId = fromBackgroundItemId;
    }
    if (hasId(fromConnectionId) && parsedFromPoint) {
      connection.fromConnectionId = fromConnectionId;
      connection.fromPoint = parsedFromPoint;
    }
    if (parsedFromPoint && !hasId(fromConnectionId)) {
      connection.fromPoint = parsedFromPoint;
    }
    if (hasId(toDeviceId)) {
      connection.toDeviceId = toDeviceId;
    }
    if (hasId(toBackgroundItemId)) {
      connection.toBackgroundItemId = toBackgroundItemId;
    }
    if (hasId(toConnectionId) && parsedToPoint) {
      connection.toConnectionId = toConnectionId;
      connection.toPoint = parsedToPoint;
    }
    if (parsedToPoint && !hasId(toConnectionId)) {
      connection.toPoint = parsedToPoint;
    }
    if (isFarmDevicePort(fromPort)) {
      connection.fromPort = fromPort;
    }
    if (isFarmDevicePort(toPort)) {
      connection.toPort = toPort;
    }
    if (parsedWaypoints && parsedWaypoints.length > 0) {
      connection.waypoints = parsedWaypoints;
    }

    seen.add(id);
    connections.push(connection);
  }

  return connections;
}
