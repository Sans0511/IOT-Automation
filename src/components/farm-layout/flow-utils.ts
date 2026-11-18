import {
  FARM_BACKGROUND_LABELS,
  FARM_BACKGROUND_PORT_LABELS,
  FARM_DEVICE_PORT_LABELS,
  type FarmBackgroundPortSide,
  type FarmDevicePort,
  type FarmFlowEndpointRef,
  type FarmLayoutBackgroundItem,
  type FarmLayoutConnection,
  type FarmLayoutDevice,
} from "@/lib/farm-layout";

export function sameFlowEndpoint(
  left: FarmFlowEndpointRef,
  right: FarmFlowEndpointRef,
): boolean {
  if (left.kind !== right.kind) {
    return false;
  }

  if (left.kind === "device" && right.kind === "device") {
    return left.deviceId === right.deviceId && left.port === right.port;
  }

  if (left.kind === "backgroundItem" && right.kind === "backgroundItem") {
    return (
      left.backgroundItemId === right.backgroundItemId &&
      left.port === right.port
    );
  }

  if (left.kind === "connection" && right.kind === "connection") {
    return (
      left.connectionId === right.connectionId &&
      left.point.x === right.point.x &&
      left.point.y === right.point.y
    );
  }

  if (left.kind === "point" && right.kind === "point") {
    return left.point.x === right.point.x && left.point.y === right.point.y;
  }

  return false;
}

export function endpointOfConnection(
  connection: FarmLayoutConnection,
  side: "from" | "to",
): FarmFlowEndpointRef | null {
  if (side === "from") {
    if (connection.fromDeviceId) {
      return {
        kind: "device",
        deviceId: connection.fromDeviceId,
        ...(connection.fromPort ? { port: connection.fromPort } : {}),
      };
    }
    if (connection.fromBackgroundItemId) {
      return {
        kind: "backgroundItem",
        backgroundItemId: connection.fromBackgroundItemId,
        ...(connection.fromBackgroundPort
          ? { port: connection.fromBackgroundPort }
          : {}),
      };
    }
    if (connection.fromConnectionId && connection.fromPoint) {
      return {
        kind: "connection",
        connectionId: connection.fromConnectionId,
        point: connection.fromPoint,
      };
    }
    return connection.fromPoint
      ? { kind: "point", point: connection.fromPoint }
      : null;
  }

  if (connection.toDeviceId) {
    return {
      kind: "device",
      deviceId: connection.toDeviceId,
      ...(connection.toPort ? { port: connection.toPort } : {}),
    };
  }
  if (connection.toBackgroundItemId) {
    return {
      kind: "backgroundItem",
      backgroundItemId: connection.toBackgroundItemId,
      ...(connection.toBackgroundPort ? { port: connection.toBackgroundPort } : {}),
    };
  }
  if (connection.toConnectionId && connection.toPoint) {
    return {
      kind: "connection",
      connectionId: connection.toConnectionId,
      point: connection.toPoint,
    };
  }
  return connection.toPoint
    ? { kind: "point", point: connection.toPoint }
    : null;
}

export function endpointPortLabel(
  connection: FarmLayoutConnection,
  side: "from" | "to",
): string {
  const devicePort: FarmDevicePort | undefined =
    side === "from" ? connection.fromPort : connection.toPort;
  const backgroundPort: FarmBackgroundPortSide | undefined =
    side === "from"
      ? connection.fromBackgroundPort
      : connection.toBackgroundPort;
  const connectionId =
    side === "from"
      ? connection.fromConnectionId
      : connection.toConnectionId;
  const point = side === "from" ? connection.fromPoint : connection.toPoint;

  if (devicePort) {
    return FARM_DEVICE_PORT_LABELS[devicePort];
  }
  if (backgroundPort) {
    return FARM_BACKGROUND_PORT_LABELS[backgroundPort];
  }
  if (connectionId) {
    return "On flow line";
  }
  if (point) {
    return "Free point";
  }

  return "Center";
}

export function connectionLabel(
  connection: FarmLayoutConnection,
  side: "from" | "to",
  devicesById: Map<string, FarmLayoutDevice>,
  backgroundItems: FarmLayoutBackgroundItem[],
): string {
  const id = side === "from" ? connection.fromDeviceId : connection.toDeviceId;
  const backgroundId =
    side === "from"
      ? connection.fromBackgroundItemId
      : connection.toBackgroundItemId;
  const connectionId =
    side === "from"
      ? connection.fromConnectionId
      : connection.toConnectionId;
  const point = side === "from" ? connection.fromPoint : connection.toPoint;

  if (id) {
    return devicesById.get(id)?.name ?? "Unknown device";
  }

  if (backgroundId) {
    const item = backgroundItems.find(
      (backgroundItem) => backgroundItem.id === backgroundId,
    );
    return item ? FARM_BACKGROUND_LABELS[item.type] : "Removed item";
  }

  if (connectionId) {
    return "Another flow line";
  }

  return point ? `Point (${point.x}, ${point.y})` : "Free end";
}
