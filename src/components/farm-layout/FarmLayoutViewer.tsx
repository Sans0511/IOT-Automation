"use client";

import { useMemo } from "react";
import {
  DEVICE_TYPE_LABELS,
  FARM_BACKGROUND_LABELS,
  FARM_DEVICE_PORT_OFFSET,
  type FarmBackgroundItemType,
  type FarmLayoutConnection,
  type FarmLayoutData,
  type FarmLayoutDevice,
  type FarmLayoutPlacement,
  type FarmPoint,
} from "@/lib/farm-layout";

type ResolvedEndpoint = { point: FarmPoint; offset: number };

type ViewerProps = {
  layout: FarmLayoutData;
  devices: FarmLayoutDevice[];
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

function getDevicePorts(type: string): ("inlet" | "outlet")[] {
  if (type === "SOLENOID_VALVE" || type === "VALVE") {
    return ["inlet", "outlet"];
  }

  if (
    type === "PUMP" ||
    type === "MOTOR_PUMP" ||
    type === "SMART_IRRIGATION_CONTROLLER"
  ) {
    return ["outlet"];
  }

  return [];
}

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

function endpointFor(
  placement: FarmLayoutPlacement,
  port?: "inlet" | "outlet",
): ResolvedEndpoint {
  if (!port) {
    return { point: { x: placement.x, y: placement.y }, offset: 32 };
  }

  const radians = (placement.rotation * Math.PI) / 180;
  const distance = port === "inlet" ? -FARM_DEVICE_PORT_OFFSET : FARM_DEVICE_PORT_OFFSET;

  return {
    point: {
      x: placement.x + distance * Math.cos(radians),
      y: placement.y + distance * Math.sin(radians),
    },
    offset: 0,
  };
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
    candidates.push({ point: { x: item.x, y: item.y }, offset: centerOffset });
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
      return item ? { point: { x: item.x, y: item.y }, offset: 32 } : null;
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
    return item ? { point: { x: item.x, y: item.y }, offset: 36 } : null;
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

export default function FarmLayoutViewer({ layout, devices }: ViewerProps) {
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
  const flowPaths = useMemo(
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

          return toPolyline(
            buildFlowPoints(
              from.point,
              to.point,
              connection.waypoints ?? [],
              from.offset,
              to.offset,
            ),
          );
        })
        .filter((path): path is string => path !== null),
    [layout.connections, placementsById, itemsById],
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
        {flowPaths.map((path, index) => (
          <g key={index}>
            <polyline
              points={path}
              fill="none"
              stroke="#0284c7"
              strokeWidth={7}
              strokeOpacity={0.16}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points={path}
              fill="none"
              stroke="#0284c7"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <polyline
              points={path}
              fill="none"
              stroke="#ffffff"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="10 8"
            >
              <animate
                attributeName="stroke-dashoffset"
                from="0"
                to="-36"
                dur="1s"
                repeatCount="indefinite"
              />
            </polyline>
          </g>
        ))}
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

      {layout.placements.map((placement) => {
        const device = devicesById.get(placement.deviceId);
        const type = device?.type ?? placement.presetKey ?? "DEVICE";
        const icon = DEVICE_ICONS[type];
        const label = deviceLabel(placement, devicesById);

        return (
          <div
            key={placement.deviceId}
            className="absolute flex flex-col items-center"
            style={{
              left: `${(placement.x / layout.width) * 100}%`,
              top: `${(placement.y / layout.height) * 100}%`,
              transform: `translate(-50%, -50%) rotate(${placement.rotation}deg)`,
            }}
          >
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
            <span className="mt-1 max-w-28 truncate rounded bg-white/90 px-1 text-[10px] font-medium text-slate-700 shadow-sm">
              {label}
            </span>
          </div>
        );
      })}

      {layout.placements.flatMap((placement) => {
        const device = devicesById.get(placement.deviceId);
        const type = device?.type ?? placement.presetKey ?? "DEVICE";

        return getDevicePorts(type).map((port) => {
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
                {port === "inlet" ? "IN" : "OUT"}
              </span>
            </div>
          );
        });
      })}
    </div>
  );
}
