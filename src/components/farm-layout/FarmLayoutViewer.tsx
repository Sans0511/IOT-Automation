"use client";

import { useMemo } from "react";
import { isControllableDeviceType } from "@/lib/device-control";
import {
  getDeviceRuntimeStatus,
  type DeviceMessageEnvelope,
  type DeviceRuntimeState,
  type DeviceRuntimeStatus,
} from "@/lib/telemetry";
import {
  DEVICE_TYPE_LABELS,
  FARM_BACKGROUND_LABELS,
  FARM_BACKGROUND_PORT_SIDES,
  getFarmBackgroundPortPoint,
  getFarmDevicePortPoint,
  getFarmDevicePortRole,
  getFarmDevicePorts,
  type FarmBackgroundItemType,
  type FarmBackgroundPortSide,
  type FarmDevicePort,
  type FarmLayoutConnection,
  type FarmLayoutData,
  type FarmLayoutDevice,
  type FarmLayoutPlacement,
  type FarmPoint,
} from "@/lib/farm-layout";

type ResolvedEndpoint = { point: FarmPoint; offset: number };
type StatusMap = Record<string, DeviceMessageEnvelope>;
type FlowState = "active" | "inactive" | "unknown";
type FlowVisual = { path: string; state: FlowState };

type ViewerProps = {
  layout: FarmLayoutData;
  devices: FarmLayoutDevice[];
  statuses: StatusMap;
  onDeviceDoubleClick?: (device: FarmLayoutDevice) => void;
};

const SNAP_DISTANCE = 40;

const DEVICE_ICONS: Record<string, string> = {
  MOTOR_PUMP: "/background-items/motor-pump-icon.svg",
  SOLENOID_VALVE: "/background-items/solenoid-valve-icon.svg",
  MOISTURE_SENSOR: "/background-items/moisture-detection-device-icon.svg",
  RAIN_DETECTION: "/background-items/rain-detection-device-icon.svg",
};

const BACKGROUND_ICONS: Partial<Record<FarmBackgroundItemType, string>> = {
  TREE: "/background-items/coconut-tree.png",
  APPLE_TREE: "/background-items/apple-tree.png",
  MANGO_TREE: "/background-items/mango-tree-icon.svg",
  ROSE_PLANT: "/background-items/rose-plant-icon.svg",
};

const BACKGROUND_FALLBACKS: Partial<Record<FarmBackgroundItemType, string>> = {
  WATER_TANK: "TANK",
  SPRINKLER_LINE: "PIPE",
  DELIVERY_POINT: "OUT",
  POND: "POND",
  SHED: "SHED",
  FLOWER_BED: "FLOWER",
};

const DEVICE_COLORS: Record<string, string> = {
  VALVE: "#f97316",
  MOISTURE_SENSOR: "#0ea5e9",
  PUMP: "#8b5cf6",
  WEATHER_STATION: "#14b8a6",
  MOTOR_PUMP: "#7c3aed",
  SOLENOID_VALVE: "#ea580c",
  RAIN_DETECTION: "#0ea5e9",
  SMART_IRRIGATION_CONTROLLER: "#4f46e5",
};

const FLOW_STYLES: Record<
  FlowState,
  { glow: string; line: string; dash: string; opacity: number; animate: boolean }
> = {
  active: {
    glow: "#0284c7",
    line: "#0284c7",
    dash: "#ffffff",
    opacity: 0.16,
    animate: true,
  },
  inactive: {
    glow: "#94a3b8",
    line: "#94a3b8",
    dash: "#ffffff",
    opacity: 0.08,
    animate: false,
  },
  unknown: {
    glow: "#94a3b8",
    line: "#94a3b8",
    dash: "#ffffff",
    opacity: 0.08,
    animate: false,
  },
};

const STATUS_STYLES: Record<DeviceRuntimeState, string> = {
  RUNNING: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  OPEN: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  STOPPED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  CLOSED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  ONLINE: "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300",
  OFFLINE: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
  STALE: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  "NO DATA": "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

function direction(from: FarmPoint, to: FarmPoint): FarmPoint {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
}

function orthogonalPath(points: FarmPoint[]): number[] {
  const result = [points[0].x, points[0].y];

  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const current = points[index];

    if (Math.abs(current.x - previous.x) >= Math.abs(current.y - previous.y)) {
      result.push(current.x, previous.y);
    } else {
      result.push(previous.x, current.y);
    }

    result.push(current.x, current.y);
  }

  return result;
}

function buildFlowPoints(
  from: FarmPoint,
  to: FarmPoint,
  waypoints: FarmPoint[],
  fromOffset: number,
  toOffset: number,
): number[] {
  if (waypoints.length === 0) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const horizontalDirection = dx >= 0 ? 1 : -1;
    const verticalDirection = dy >= 0 ? 1 : -1;
    const startX = from.x + horizontalDirection * fromOffset;
    const startY = from.y + verticalDirection * fromOffset;
    const endX = to.x - horizontalDirection * toOffset;
    const endY = to.y - verticalDirection * toOffset;

    if (Math.abs(dx) >= Math.abs(dy)) {
      const bendX = Math.abs(endX - startX) < 24 ? (startX + endX) / 2 : endX;
      const finalY = dy === 0 ? to.y : endY;

      return [startX, from.y, bendX, from.y, bendX, finalY];
    }

    const bendY = Math.abs(endY - startY) < 24 ? (startY + endY) / 2 : endY;
    const finalX = dx === 0 ? to.x : endX;

    return [from.x, startY, from.x, bendY, finalX, bendY];
  }

  const sourceDirection = direction(from, waypoints[0]);
  const targetDirection = direction(to, waypoints[waypoints.length - 1]);
  const path = [
    {
      x: from.x + sourceDirection.x * fromOffset,
      y: from.y + sourceDirection.y * fromOffset,
    },
    ...waypoints,
    {
      x: to.x + targetDirection.x * toOffset,
      y: to.y + targetDirection.y * toOffset,
    },
  ];

  return orthogonalPath(path);
}

function toPolyline(points: number[]): string {
  const result: string[] = [];

  for (let index = 0; index < points.length; index += 2) {
    result.push(`${points[index]},${points[index + 1]}`);
  }

  return result.join(" ");
}

function pointToSegmentDistance(
  point: FarmPoint,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(point.x - x1, point.y - y1);
  }

  const t = Math.max(
    0,
    Math.min(1, ((point.x - x1) * dx + (point.y - y1) * dy) / lengthSquared),
  );

  return Math.hypot(point.x - (x1 + t * dx), point.y - (y1 + t * dy));
}

function pointTouchesPath(point: FarmPoint, points: number[], tolerance = 8): boolean {
  for (let index = 2; index < points.length; index += 2) {
    const distance = pointToSegmentDistance(
      point,
      points[index - 2],
      points[index - 1],
      points[index],
      points[index + 1],
    );

    if (distance <= tolerance) {
      return true;
    }
  }

  return false;
}

function endpointFor(
  placement: FarmLayoutPlacement,
  port?: FarmDevicePort,
): ResolvedEndpoint {
  if (!port) {
    return { point: { x: placement.x, y: placement.y }, offset: 32 };
  }

  return { point: getFarmDevicePortPoint(placement, port), offset: 0 };
}

function endpointForBackground(
  item: FarmLayoutData["backgroundItems"][number],
  port?: FarmBackgroundPortSide,
  centerOffset = 32,
): ResolvedEndpoint {
  if (!port) {
    return { point: { x: item.x, y: item.y }, offset: centerOffset };
  }

  return { point: getFarmBackgroundPortPoint(item, port), offset: 0 };
}

function snapFreeEndpoint(
  point: FarmPoint,
  placementsById: Map<string, FarmLayoutPlacement>,
  itemsById: Map<string, FarmLayoutData["backgroundItems"][number]>,
  side: "from" | "to",
): ResolvedEndpoint {
  const centerOffset = side === "from" ? 32 : 36;
  const candidates: ResolvedEndpoint[] = [];

  for (const placement of placementsById.values()) {
    const center = endpointFor(placement);
    candidates.push({ point: center.point, offset: centerOffset });
    candidates.push(endpointFor(placement, "inlet"));
    candidates.push(endpointFor(placement, "outlet"));
  }

  for (const item of itemsById.values()) {
    candidates.push(endpointForBackground(item, undefined, centerOffset));
    for (const side of FARM_BACKGROUND_PORT_SIDES) {
      candidates.push(endpointForBackground(item, side));
    }
  }

  let best: ResolvedEndpoint | null = null;
  let bestDistance = SNAP_DISTANCE;

  for (const candidate of candidates) {
    const distance = Math.hypot(
      point.x - candidate.point.x,
      point.y - candidate.point.y,
    );

    if (distance <= bestDistance) {
      best = candidate;
      bestDistance = distance;
    }
  }

  return best ?? { point, offset: 0 };
}

function resolveEndpoint(
  connection: FarmLayoutConnection,
  side: "from" | "to",
  placementsById: Map<string, FarmLayoutPlacement>,
  itemsById: Map<string, FarmLayoutData["backgroundItems"][number]>,
): ResolvedEndpoint | null {
  if (side === "from") {
    if (connection.fromDeviceId) {
      const placement = placementsById.get(connection.fromDeviceId);

      if (!placement) {
        return null;
      }

      const endpoint = endpointFor(placement, connection.fromPort);

      return {
        point: endpoint.point,
        offset: connection.fromPort ? 0 : 32,
      };
    }

    if (connection.fromBackgroundItemId) {
      const item = itemsById.get(connection.fromBackgroundItemId);
      return item
        ? endpointForBackground(item, connection.fromBackgroundPort, 32)
        : null;
    }

    if (connection.fromPoint) {
      return connection.fromConnectionId
        ? { point: connection.fromPoint, offset: 0 }
        : snapFreeEndpoint(
            connection.fromPoint,
            placementsById,
            itemsById,
            "from",
          );
    }

    return null;
  }

  if (connection.toDeviceId) {
    const placement = placementsById.get(connection.toDeviceId);

    if (!placement) {
      return null;
    }

    const endpoint = endpointFor(placement, connection.toPort);

    return {
      point: endpoint.point,
      offset: connection.toPort ? 0 : 36,
    };
  }

  if (connection.toBackgroundItemId) {
    const item = itemsById.get(connection.toBackgroundItemId);
    return item
      ? endpointForBackground(item, connection.toBackgroundPort, 36)
      : null;
  }

  if (connection.toPoint) {
    return connection.toConnectionId
      ? { point: connection.toPoint, offset: 0 }
      : snapFreeEndpoint(
          connection.toPoint,
          placementsById,
          itemsById,
          "to",
        );
  }

  return null;
}

function deviceLabel(
  placement: FarmLayoutPlacement,
  devicesById: Map<string, FarmLayoutDevice>,
): string {
  if (placement.label) {
    return placement.label;
  }

  const device = devicesById.get(placement.deviceId);

  if (device) {
    return device.name;
  }

  const type = placement.presetKey ?? "DEVICE";
  return DEVICE_TYPE_LABELS[type] ?? type.replaceAll("_", " ");
}

function isPumpType(type: string): boolean {
  return type === "PUMP" || type === "MOTOR_PUMP";
}

function isValveType(type: string): boolean {
  return type === "SOLENOID_VALVE" || type === "VALVE";
}

function getValveGateState(
  connection: FarmLayoutConnection,
  devicesById: Map<string, FarmLayoutDevice>,
  runtimeByDevice: Map<string, DeviceRuntimeStatus>,
  statuses: StatusMap,
): FlowState | null {
  if (!connection.fromDeviceId) {
    return null;
  }

  const type = devicesById.get(connection.fromDeviceId)?.type ?? "";

  if (!isValveType(type)) {
    return null;
  }

  if (!statuses[connection.fromDeviceId]) {
    return "unknown";
  }

  return runtimeByDevice.get(connection.fromDeviceId)?.active === true
    ? null
    : "inactive";
}

function getDirectPumpState(
  connection: FarmLayoutConnection,
  devicesById: Map<string, FarmLayoutDevice>,
  runtimeByDevice: Map<string, DeviceRuntimeStatus>,
  statuses: StatusMap,
): FlowState | null {
  const pumpIds: string[] = [];

  for (const deviceId of [connection.fromDeviceId, connection.toDeviceId]) {
    if (!deviceId || pumpIds.includes(deviceId)) {
      continue;
    }

    const type = devicesById.get(deviceId)?.type ?? "";

    if (isPumpType(type)) {
      pumpIds.push(deviceId);
    }
  }

  if (pumpIds.length === 0) {
    return null;
  }

  if (pumpIds.some((deviceId) => !statuses[deviceId])) {
    return "unknown";
  }

  return pumpIds.some((deviceId) => runtimeByDevice.get(deviceId)?.active === true)
    ? "active"
    : "inactive";
}

function resolveFlowStates(
  connections: FarmLayoutConnection[],
  devicesById: Map<string, FarmLayoutDevice>,
  runtimeByDevice: Map<string, DeviceRuntimeStatus>,
  statuses: StatusMap,
  placementsById: Map<string, FarmLayoutPlacement>,
  itemsById: Map<string, FarmLayoutData["backgroundItems"][number]>,
): Map<string, FlowState> {
  const connectionsById = new Map(
    connections.map((connection) => [connection.id, connection]),
  );
  const resolved = new Map<string, FlowState>();
  const visiting = new Set<string>();
  const geometryById = new Map<
    string,
    { from: FarmPoint; to: FarmPoint; points: number[] }
  >();

  for (const connection of connections) {
    const from = resolveEndpoint(connection, "from", placementsById, itemsById);
    const to = resolveEndpoint(connection, "to", placementsById, itemsById);

    if (!from || !to) {
      continue;
    }

    geometryById.set(connection.id, {
      from: from.point,
      to: to.point,
      points: buildFlowPoints(
        from.point,
        to.point,
        connection.waypoints ?? [],
        from.offset,
        to.offset,
      ),
    });
  }

  function parentConnections(
    connection: FarmLayoutConnection,
  ): FarmLayoutConnection[] {
    const parents = new Map<string, FarmLayoutConnection>();

    const add = (parent?: FarmLayoutConnection) => {
      if (parent && parent.id !== connection.id) {
        parents.set(parent.id, parent);
      }
    };

    if (connection.fromConnectionId) {
      add(connectionsById.get(connection.fromConnectionId));
    }

    if (connection.toConnectionId) {
      add(connectionsById.get(connection.toConnectionId));
    }

    for (const candidate of connections) {
      if (candidate.toConnectionId === connection.id) {
        add(candidate);
      }
    }

    if (connection.fromDeviceId) {
      for (const candidate of connections) {
        if (
          candidate.id !== connection.id &&
          candidate.toDeviceId === connection.fromDeviceId
        ) {
          add(candidate);
        }
      }
    }

    if (connection.fromBackgroundItemId && connection.fromBackgroundPort) {
      for (const candidate of connections) {
        if (candidate.id === connection.id) {
          continue;
        }

        const parentAtSamePort =
          candidate.toBackgroundItemId === connection.fromBackgroundItemId &&
          candidate.toBackgroundPort === connection.fromBackgroundPort;
        const siblingAtSamePort =
          candidate.fromBackgroundItemId === connection.fromBackgroundItemId &&
          candidate.fromBackgroundPort === connection.fromBackgroundPort;

        if (parentAtSamePort || siblingAtSamePort) {
          add(candidate);
        }
      }
    }

    const geometry = geometryById.get(connection.id);

    if (geometry) {
      for (const candidate of connections) {
        if (candidate.id === connection.id) {
          continue;
        }

        const candidateGeometry = geometryById.get(candidate.id);

        if (!candidateGeometry) {
          continue;
        }

        if (
          pointTouchesPath(geometry.from, candidateGeometry.points) ||
          pointTouchesPath(geometry.to, candidateGeometry.points)
        ) {
          add(candidate);
        }
      }
    }

    return Array.from(parents.values());
  }

  function resolve(connection: FarmLayoutConnection): FlowState {
    const cached = resolved.get(connection.id);

    if (cached) {
      return cached;
    }

    if (visiting.has(connection.id)) {
      return "unknown";
    }

    visiting.add(connection.id);
    let state: FlowState = "unknown";

    try {
      const valveGate = getValveGateState(
        connection,
        devicesById,
        runtimeByDevice,
        statuses,
      );

      const direct =
        valveGate === null
          ? getDirectPumpState(
              connection,
              devicesById,
              runtimeByDevice,
              statuses,
            )
          : valveGate;

      if (direct !== null) {
        state = direct;
      } else {
        let sawInactivePump = false;

        for (const parent of parentConnections(connection)) {
          const parentState = resolve(parent);

          if (parentState === "active") {
            state = "active";
            break;
          }

          if (parentState === "inactive") {
            sawInactivePump = true;
          }
        }

        if (state !== "active" && sawInactivePump) {
          state = "inactive";
        }
      }
    } finally {
      visiting.delete(connection.id);
    }

    resolved.set(connection.id, state);
    return state;
  }

  for (const connection of connections) {
    resolve(connection);
  }

  return resolved;
}

export default function FarmLayoutViewer({
  layout,
  devices,
  statuses,
  onDeviceDoubleClick,
}: ViewerProps) {
  const placementsById = useMemo(
    () => new Map(layout.placements.map((placement) => [placement.deviceId, placement])),
    [layout.placements],
  );
  const itemsById = useMemo(
    () => new Map(layout.backgroundItems.map((item) => [item.id, item])),
    [layout.backgroundItems],
  );
  const devicesById = useMemo(
    () => new Map(devices.map((device) => [device.id, device])),
    [devices],
  );
  const runtimeByDevice = useMemo(
    () =>
      new Map(
        devices.map((device) => [
          device.id,
          getDeviceRuntimeStatus(statuses[device.id], device.type),
        ]),
      ),
    [devices, statuses],
  );
  const flowStates = useMemo(
    () =>
      resolveFlowStates(
        layout.connections,
        devicesById,
        runtimeByDevice,
        statuses,
        placementsById,
        itemsById,
      ),
    [
      devicesById,
      itemsById,
      layout.connections,
      placementsById,
      runtimeByDevice,
      statuses,
    ],
  );
  const flowVisuals = useMemo(
    () =>
      layout.connections
        .map((connection) => {
          const from = resolveEndpoint(
            connection,
            "from",
            placementsById,
            itemsById,
          );
          const to = resolveEndpoint(connection, "to", placementsById, itemsById);

          if (!from || !to) {
            return null;
          }

          return {
            path: toPolyline(
              buildFlowPoints(
                from.point,
                to.point,
                connection.waypoints ?? [],
                from.offset,
                to.offset,
              ),
            ),
            state: flowStates.get(connection.id) ?? "unknown",
          };
        })
        .filter((visual): visual is FlowVisual => visual !== null),
    [flowStates, itemsById, layout.connections, placementsById],
  );

  return (
    <div
      className="relative w-full overflow-hidden rounded-xl border-2 border-emerald-500 bg-white"
      style={{ aspectRatio: `${layout.width} / ${layout.height}` }}
    >
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(to right, rgba(16,185,129,0.10) 1px, transparent 1px), linear-gradient(to bottom, rgba(16,185,129,0.10) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <svg
        className="absolute inset-0 h-full w-full"
        viewBox={`0 0 ${layout.width} ${layout.height}`}
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {flowVisuals.map((visual, index) => {
          const style = FLOW_STYLES[visual.state];

          return (
            <g key={index}>
              <polyline
                points={visual.path}
                fill="none"
                stroke={style.glow}
                strokeWidth={7}
                strokeOpacity={style.opacity}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points={visual.path}
                fill="none"
                stroke={style.line}
                strokeWidth={3}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <polyline
                points={visual.path}
                fill="none"
                stroke={style.dash}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray="10 8"
              >
                {style.animate ? (
                  <animate
                    attributeName="stroke-dashoffset"
                    from="0"
                    to="-36"
                    dur="1s"
                    repeatCount="indefinite"
                  />
                ) : null}
              </polyline>
            </g>
          );
        })}
      </svg>

      {layout.backgroundItems.map((item) => {
        const icon = BACKGROUND_ICONS[item.type];
        const fallback = BACKGROUND_FALLBACKS[item.type] ?? FARM_BACKGROUND_LABELS[item.type].slice(0, 1);

        return (
          <div
            key={item.id}
            className="absolute flex flex-col items-center"
            style={{
              left: `${(item.x / layout.width) * 100}%`,
              top: `${(item.y / layout.height) * 100}%`,
              transform: `translate(-50%, -50%) scale(${item.scale}) rotate(${item.rotation}deg)`,
            }}
          >
            <span
              className="flex h-12 w-12 items-center justify-center rounded-lg bg-emerald-50 text-[10px] font-bold text-emerald-700 shadow-sm ring-1 ring-emerald-200"
              style={
                icon
                  ? {
                      backgroundImage: `url(${icon})`,
                      backgroundSize: "contain",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "center",
                    }
                  : undefined
              }
            >
              {icon ? null : fallback}
            </span>
            <span className="mt-1 rounded bg-white/90 px-1 text-[10px] font-medium text-slate-600 shadow-sm">
              {FARM_BACKGROUND_LABELS[item.type]}
            </span>
          </div>
        );
      })}

      {layout.backgroundItems.flatMap((item) =>
        FARM_BACKGROUND_PORT_SIDES.map((side) => {
          const point = getFarmBackgroundPortPoint(item, side);

          return (
            <div
              key={`${item.id}-${side}`}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${(point.x / layout.width) * 100}%`,
                top: `${(point.y / layout.height) * 100}%`,
              }}
            >
              <span className="block h-2.5 w-2.5 rounded-full border-2 border-emerald-600 bg-white shadow-sm" />
            </div>
          );
        }),
      )}

      {layout.placements.map((placement) => {
        const device = devicesById.get(placement.deviceId);
        const type = device?.type ?? placement.presetKey ?? "DEVICE";
        const icon = DEVICE_ICONS[type];
        const label = deviceLabel(placement, devicesById);
        const runtime = runtimeByDevice.get(placement.deviceId);
        const runtimeState = runtime?.state ?? "NO DATA";
        const controllable = device
          ? isControllableDeviceType(device.type)
          : false;

        return (
          <div
            key={placement.deviceId}
            className={`absolute flex flex-col items-center ${
              controllable ? "cursor-pointer select-none" : ""
            }`}
            title={controllable ? "Double-click to toggle" : undefined}
            onDoubleClick={
              device && controllable
                ? () => onDeviceDoubleClick?.(device)
                : undefined
            }
            style={{
              left: `${(placement.x / layout.width) * 100}%`,
              top: `${(placement.y / layout.height) * 100}%`,
              transform: `translate(-50%, -50%) rotate(${placement.rotation}deg)`,
            }}
          >
            <span className="mb-1 max-w-28 truncate rounded bg-white/90 px-1 text-[10px] font-medium text-slate-700 shadow-sm">
              {label}
            </span>
            <span
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-sky-50 text-[10px] font-bold text-sky-700 shadow-sm ring-1 ring-sky-200"
              style={
                icon
                  ? {
                      backgroundImage: `url(${icon})`,
                      backgroundSize: "contain",
                      backgroundRepeat: "no-repeat",
                      backgroundPosition: "center",
                    }
                  : undefined
              }
            >
              {icon ? null : type.slice(0, 3)}
            </span>
            <span
              className={`mt-0.5 rounded px-1.5 py-0.5 text-[9px] font-semibold shadow-sm ${STATUS_STYLES[runtimeState]}`}
            >
              {runtimeState}
            </span>
          </div>
        );
      })}

      {layout.placements.flatMap((placement) => {
        const device = devicesById.get(placement.deviceId);
        const type = device?.type ?? placement.presetKey ?? "DEVICE";

        return getFarmDevicePorts(type).map((port) => {
          const endpoint = endpointFor(placement, port);

          return (
            <div
              key={`${placement.deviceId}-${port}`}
              className="absolute -translate-x-1/2 -translate-y-1/2"
              style={{
                left: `${(endpoint.point.x / layout.width) * 100}%`,
                top: `${(endpoint.point.y / layout.height) * 100}%`,
              }}
            >
              <span
                className="block h-3 w-3 rounded-full border-2 bg-white shadow-sm"
                style={{
                  borderColor: DEVICE_COLORS[type] ?? "#0284c7",
                }}
              />
              <span className="absolute left-1/2 top-3 -translate-x-1/2 text-[8px] font-bold uppercase text-slate-600">
                {getFarmDevicePortRole(port) === "inlet" ? "IN" : "OUT"}
              </span>
            </div>
          );
        });
      })}
    </div>
  );
}
