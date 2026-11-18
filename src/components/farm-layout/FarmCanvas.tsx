"use client";

import Konva from "konva";
import { useEffect, useMemo, useRef, useState, type DragEvent as ReactDragEvent } from "react";
import {
  Circle,
  Group,
  Image as KonvaImage,
  Layer,
  Line,
  Rect,
  Stage,
  Text,
} from "react-konva";
import BackgroundItemNode from "./BackgroundItemNode";
import ConnectionLine from "./ConnectionLine";
import { useCanvasImage } from "./useCanvasImage";
import {
  BACKGROUND_ITEM_DRAG_TYPE,
  DEVICE_PRESET_DRAG_TYPE,
  DEVICE_TYPE_LABELS,
  FARM_BACKGROUND_ITEM_TYPES,
  FARM_CANVAS_HEIGHT,
  FARM_CANVAS_WIDTH,
  FARM_LAYOUT_GRID,
  findNearbyFarmFlowPort,
  getFarmBackgroundPortPoint,
  getFarmDevicePortLocalPoint,
  getFarmDevicePortPoint,
  getFarmDevicePortRole,
  getFarmDevicePortSide,
  getFarmDevicePorts,
  isFarmBackgroundPortSide,
  isFarmDevicePresetKey,
  isFarmDevicePort,
  type FarmBackgroundItemType,
  type FarmBackgroundPortSide,
  type FarmDevicePort,
  type FarmDevicePresetKey,
  type FarmFlowEndpointRef,
  type FarmLayoutBackgroundItem,
  type FarmLayoutConnection,
  type FarmLayoutDevice,
  type FarmLayoutPlacement,
  type FarmPoint,
} from "@/lib/farm-layout";

type FarmCanvasProps = {
  width: number;
  height: number;
  devices: FarmLayoutDevice[];
  placements: FarmLayoutPlacement[];
  backgroundItems: FarmLayoutBackgroundItem[];
  connections: FarmLayoutConnection[];
  selectedDeviceId: string | null;
  selectedBackgroundItemId: string | null;
  selectedConnectionId: string | null;
  linkMode: boolean;
  linkSource: FarmFlowEndpointRef | null;
  draftWaypoints: FarmPoint[];
  snapToGrid: boolean;
  zoom: number;
  onSelect: (deviceId: string | null, port?: FarmDevicePort) => void;
  onSelectConnection: (connectionId: string | null) => void;
  onCanvasFlowPoint: (point: FarmPoint) => void;
  onCancelFlow: () => void;
  onSelectFlowConnection: (connectionId: string, point: FarmPoint) => void;
  onMoveWaypoint: (
    connectionId: string,
    index: number,
    point: FarmPoint,
  ) => void;
  onMoveFlowEndpoint: (
    connectionId: string,
    side: "from" | "to",
    point: FarmPoint,
  ) => void;
  onAddDevice: (deviceId: string, x: number, y: number) => void;
  onAddPreset: (presetKey: FarmDevicePresetKey, x: number, y: number) => void;
  onMoveDevice: (deviceId: string, x: number, y: number) => void;
  onSelectBackgroundItem: (
    id: string | null,
    port?: FarmBackgroundPortSide,
  ) => void;
  onAddBackgroundItem: (
    type: FarmBackgroundItemType,
    x: number,
    y: number,
  ) => void;
  onMoveBackgroundItem: (id: string, x: number, y: number) => void;
  onZoomChange: (zoom: number) => void;
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

function clamp(value: number, max: number): number {
  return Math.min(max, Math.max(0, value));
}

function snap(value: number, enabled: boolean): number {
  if (!enabled) {
    return Math.round(value);
  }

  return Math.round(value / FARM_LAYOUT_GRID) * FARM_LAYOUT_GRID;
}

function endpointFor(
  placement: FarmLayoutPlacement,
  port?: FarmDevicePort,
): { x: number; y: number; usesPort: boolean } {
  if (!port) {
    return { x: placement.x, y: placement.y, usesPort: false };
  }

  const point = getFarmDevicePortPoint(placement, port);

  return { x: point.x, y: point.y, usesPort: true };
}

function portLabelOffset(port: FarmDevicePort): { x: number; y: number } {
  const side = getFarmDevicePortSide(port);

  if (!side) {
    return { x: -20, y: 11 };
  }

  if (side === "top" || side === "bottom") {
    return { x: -10, y: side === "top" ? -18 : 8 };
  }

  return { x: side === "right" ? 8 : -29, y: -5 };
}

function DeviceNode({
  device,
  placement,
  selected,
  highlighted,
  linkSourcePort,
  snapToGrid,
  draggable,
  onSelect,
  onPortDragStart,
  onAlignDrag,
  onMove,
}: {
  device: FarmLayoutDevice;
  placement: FarmLayoutPlacement;
  selected: boolean;
  highlighted: boolean;
  linkSourcePort: FarmDevicePort | null;
  snapToGrid: boolean;
  draggable: boolean;
  onSelect: (deviceId: string, port?: FarmDevicePort) => void;
  onPortDragStart: (deviceId: string, port: FarmDevicePort) => void;
  onAlignDrag: (id: string, x: number, y: number) => FarmPoint;
  onMove: (deviceId: string, x: number, y: number) => void;
}) {
  const color = DEVICE_COLORS[device.type] ?? "#64748b";
  const motorPumpImage = useCanvasImage(
    device.type === "MOTOR_PUMP"
      ? "/background-items/motor-pump-icon.svg"
      : null,
  );
  const solenoidValveImage = useCanvasImage(
    device.type === "SOLENOID_VALVE"
      ? "/background-items/solenoid-valve-icon.svg"
      : null,
  );
  const moistureSensorImage = useCanvasImage(
    device.type === "MOISTURE_SENSOR"
      ? "/background-items/moisture-detection-device-icon.svg"
      : null,
  );
  const rainDetectionImage = useCanvasImage(
    device.type === "RAIN_DETECTION"
      ? "/background-items/rain-detection-device-icon.svg"
      : null,
  );

  return (
    <Group
      name="flow-device"
      id={device.id}
      x={placement.x}
      y={placement.y}
      rotation={placement.rotation}
      draggable={draggable}
      onMouseDown={(event) => {
        event.cancelBubble = true;
        onSelect(device.id);
      }}
      onTap={(event) => {
        event.cancelBubble = true;
        onSelect(device.id);
      }}
      onDragMove={(event) => {
        const aligned = onAlignDrag(
          device.id,
          event.target.x(),
          event.target.y(),
        );
        event.target.position(aligned);
      }}
      onDragEnd={(event) => {
        const aligned = onAlignDrag(
          device.id,
          clamp(snap(event.target.x(), snapToGrid), FARM_CANVAS_WIDTH),
          clamp(snap(event.target.y(), snapToGrid), FARM_CANVAS_HEIGHT),
        );
        event.target.position(aligned);
        onMove(device.id, aligned.x, aligned.y);
      }}
    >
      {selected || highlighted ? (
        <Rect
          x={-78}
          y={-32}
          width={156}
          height={108}
          cornerRadius={10}
          stroke={highlighted ? "#2563eb" : "#16a34a"}
          strokeWidth={2}
          dash={[6, 4]}
        />
      ) : null}
      <Circle radius={25} fill="#ffffff" stroke={color} strokeWidth={4} />
      {device.type === "SOLENOID_VALVE" && solenoidValveImage ? (
        <KonvaImage
          image={solenoidValveImage}
          x={-29}
          y={-27}
          width={58}
          height={54}
        />
      ) : device.type === "VALVE" || device.type === "SOLENOID_VALVE" ? (
        <>
          <Rect x={-11} y={-4} width={22} height={8} fill={color} cornerRadius={3} />
          <Rect x={-4} y={-11} width={8} height={22} fill={color} cornerRadius={3} />
        </>
      ) : null}
      {device.type === "SMART_IRRIGATION_CONTROLLER" ? (
        <>
          <Rect x={-14} y={-10} width={28} height={22} fill={color} cornerRadius={4} />
          <Rect x={-10} y={-6} width={14} height={9} fill="#ffffff" cornerRadius={1} />
          <Circle x={9} y={-4} radius={2.5} fill="#bbf7d0" />
          <Circle x={9} y={4} radius={2.5} fill="#fde68a" />
          <Line points={[13, -10, 18, -17]} stroke={color} strokeWidth={2} />
        </>
      ) : null}
      {device.type === "MOISTURE_SENSOR" && moistureSensorImage ? (
        <KonvaImage
          image={moistureSensorImage}
          x={-29}
          y={-27}
          width={58}
          height={54}
        />
      ) : device.type === "MOISTURE_SENSOR" ? (
        <>
          <Line points={[0, -12, 0, 5]} stroke={color} strokeWidth={4} />
          <Circle y={11} radius={7} fill={color} />
        </>
      ) : null}
      {device.type === "RAIN_DETECTION" && rainDetectionImage ? (
        <KonvaImage
          image={rainDetectionImage}
          x={-29}
          y={-27}
          width={58}
          height={54}
        />
      ) : device.type === "RAIN_DETECTION" ? (
        <Circle radius={12} fill={color} />
      ) : null}
      {device.type === "MOTOR_PUMP" && motorPumpImage ? (
        <KonvaImage
          image={motorPumpImage}
          x={-29}
          y={-27}
          width={58}
          height={54}
        />
      ) : device.type === "PUMP" || device.type === "MOTOR_PUMP" ? (
        <>
          <Rect x={-12} y={-10} width={24} height={20} fill={color} cornerRadius={4} />
          <Circle x={7} y={0} radius={5} fill="#ffffff" />
        </>
      ) : null}
      {device.type === "WEATHER_STATION" ? (
        <>
          <Line points={[0, 12, 0, -8]} stroke={color} strokeWidth={4} />
          <Line points={[-10, -7, 10, -7]} stroke={color} strokeWidth={4} />
          <Line points={[-7, -1, 7, -1]} stroke={color} strokeWidth={4} />
        </>
      ) : null}
        {getFarmDevicePorts(device.type).map((port) => {
          const local = getFarmDevicePortLocalPoint(port);
          const label = portLabelOffset(port);
          const active = highlighted && linkSourcePort === port;

          return (
            <Group key={port} x={local.x} y={local.y}>
              <Circle
                name="flow-port"
                id={`${device.id}:${port}`}
                radius={active ? 8 : 5}
                fill="#ffffff"
                stroke={active ? "#2563eb" : color}
                strokeWidth={2}
                onMouseDown={(event) => {
                  event.cancelBubble = true;
                  onPortDragStart(device.id, port);
                  onSelect(device.id, port);
                }}
                onTap={(event) => {
                  event.cancelBubble = true;
                  onPortDragStart(device.id, port);
                  onSelect(device.id, port);
                }}
              />
              <Text
                x={label.x}
                y={label.y}
                width={getFarmDevicePortRole(port) === "inlet" ? 20 : 26}
                text={getFarmDevicePortRole(port) === "inlet" ? "IN" : "OUT"}
                fontSize={8}
                fontStyle="bold"
                align="center"
                fill={active ? "#1d4ed8" : "#475569"}
                listening={false}
              />
            </Group>
          );
        })}

        <Rect
          x={-72}
          y={-59}
          width={144}
          height={26}
          fill="rgba(255,255,255,0.92)"
          cornerRadius={6}
        />
        <Text
          x={-68}
          y={-53}
          width={136}
          text={placement.label || device.name}
          fontSize={12}
          fontStyle="bold"
          align="center"
          ellipsis
          fill="#1f2937"
        />
        <Text
          x={-68}
          y={32}
          width={136}
          text={DEVICE_TYPE_LABELS[device.type] ?? device.type}
          fontSize={10}
          align="center"
          fill="#64748b"
        />

    </Group>
  );
}

export default function FarmCanvas({
  width,
  height,
  devices,
  placements,
  backgroundItems,
  connections,
  selectedDeviceId,
  selectedBackgroundItemId,
  selectedConnectionId,
  linkMode,
  linkSource,
  draftWaypoints,
  snapToGrid,
  zoom,
  onSelect,
  onSelectConnection,
  onCanvasFlowPoint,
  onCancelFlow,
  onSelectFlowConnection,
  onMoveWaypoint,
  onMoveFlowEndpoint,
  onAddDevice,
  onAddPreset,
  onMoveDevice,
  onSelectBackgroundItem,
  onAddBackgroundItem,
  onMoveBackgroundItem,
  onZoomChange,
}: FarmCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const stageRef = useRef<Konva.Stage | null>(null);
  const [containerWidth, setContainerWidth] = useState(width);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [draftPoint, setDraftPoint] = useState<FarmPoint | null>(null);
  const [alignmentGuides, setAlignmentGuides] = useState<{
    vertical: number | null;
    horizontal: number | null;
  }>({ vertical: null, horizontal: null });
  const draggingFlowRef = useRef(false);
  const dragStartPointRef = useRef<FarmPoint | null>(null);

  useEffect(() => {
    const element = containerRef.current;

    if (!element) {
      return;
    }

    const updateWidth = () => setContainerWidth(element.clientWidth || width);
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);

    return () => observer.disconnect();
  }, [width]);

  const fitScale = Math.min(1, Math.max(0.25, containerWidth / width));
  const stageScale = fitScale * zoom;
  const stageWidth = width * fitScale;
  const stageHeight = height * fitScale;

  useEffect(() => {
    if (!linkMode || !linkSource) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancelFlow();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [linkMode, linkSource, onCancelFlow]);

  const devicesById = useMemo(
    () => new Map(devices.map((device) => [device.id, device])),
    [devices],
  );
  const placementsById = useMemo(
    () => new Map(placements.map((placement) => [placement.deviceId, placement])),
    [placements],
  );
  const backgroundItemsById = useMemo(
    () => new Map(backgroundItems.map((item) => [item.id, item])),
    [backgroundItems],
  );
  const selectedConnection =
    connections.find((connection) => connection.id === selectedConnectionId) ??
    null;
  const previewSource =
    linkMode && linkSource ? resolveFlowEndpoint(linkSource) : null;

  function toContent(point: FarmPoint): FarmPoint {
    return {
      x: clamp(snap((point.x - pan.x) / stageScale, snapToGrid), width),
      y: clamp(snap((point.y - pan.y) / stageScale, snapToGrid), height),
    };
  }

  function stagePointerToContent(stage: Konva.Stage | null): FarmPoint {
    return toContent(stage?.getPointerPosition() ?? { x: 0, y: 0 });
  }

  function selectNearbyPort(point: FarmPoint): boolean {
    const nearbyPort = findNearbyFarmFlowPort(
      point,
      placements,
      devices,
      backgroundItems,
    );

    if (!nearbyPort) {
      return false;
    }

    if (nearbyPort.kind === "device") {
      onSelect(nearbyPort.deviceId, nearbyPort.port);
      return true;
    }

    onSelectBackgroundItem(nearbyPort.backgroundItemId, nearbyPort.port);
    return true;
  }

  function resolveEndpoint(
    connection: FarmLayoutConnection,
    side: "from" | "to",
  ): { point: FarmPoint; offset: number } | null {
    if (side === "from") {
      if (connection.fromDeviceId) {
        const placement = placementsById.get(connection.fromDeviceId);
        if (!placement) {
          return null;
        }
        const endpoint = endpointFor(placement, connection.fromPort);
        return {
          point: { x: endpoint.x, y: endpoint.y },
          offset: endpoint.usesPort ? 0 : 32,
        };
      }

      if (connection.fromBackgroundItemId) {
        const item = backgroundItemsById.get(connection.fromBackgroundItemId);

        if (!item) {
          return null;
        }

        if (connection.fromBackgroundPort) {
          return {
            point: getFarmBackgroundPortPoint(item, connection.fromBackgroundPort),
            offset: 0,
          };
        }

        return { point: { x: item.x, y: item.y }, offset: 32 };
      }

      return connection.fromPoint
        ? { point: connection.fromPoint, offset: 0 }
        : null;
    }

    if (connection.toDeviceId) {
      const placement = placementsById.get(connection.toDeviceId);
      if (!placement) {
        return null;
      }
      const endpoint = endpointFor(placement, connection.toPort);
      return {
        point: { x: endpoint.x, y: endpoint.y },
        offset: endpoint.usesPort ? 0 : 36,
      };
    }

    if (connection.toBackgroundItemId) {
      const item = backgroundItemsById.get(connection.toBackgroundItemId);

      if (!item) {
        return null;
      }

      if (connection.toBackgroundPort) {
        return {
          point: getFarmBackgroundPortPoint(item, connection.toBackgroundPort),
          offset: 0,
        };
      }

      return { point: { x: item.x, y: item.y }, offset: 36 };
    }

    return connection.toPoint
      ? { point: connection.toPoint, offset: 0 }
      : null;
  }

  function resolveFlowEndpoint(
    endpoint: FarmFlowEndpointRef,
  ): { point: FarmPoint; offset: number } | null {
    if (endpoint.kind === "device") {
      const placement = placementsById.get(endpoint.deviceId);
      if (!placement) {
        return null;
      }
      const resolved = endpointFor(placement, endpoint.port);
      return {
        point: { x: resolved.x, y: resolved.y },
        offset: resolved.usesPort ? 0 : 32,
      };
    }

    if (endpoint.kind === "backgroundItem") {
      const item = backgroundItemsById.get(endpoint.backgroundItemId);

      if (!item) {
        return null;
      }

      if (endpoint.port) {
        return { point: getFarmBackgroundPortPoint(item, endpoint.port), offset: 0 };
      }

      return { point: { x: item.x, y: item.y }, offset: 32 };
    }

    return { point: endpoint.point, offset: 0 };
  }

  function alignDrag(
    kind: "device" | "background",
    id: string,
    x: number,
    y: number,
  ): FarmPoint {
    const halfWidth = kind === "device" ? 78 : 50;
    const halfHeight = kind === "device" ? 54 : 50;
    const tolerance = 6;
    const targetsX: number[] = [0, width / 2, width];
    const targetsY: number[] = [0, height / 2, height];

    for (const placement of placements) {
      if (placement.deviceId === id) {
        continue;
      }
      targetsX.push(placement.x - 78, placement.x, placement.x + 78);
      targetsY.push(placement.y - 54, placement.y, placement.y + 54);
    }

    for (const item of backgroundItems) {
      if (item.id === id) {
        continue;
      }
      targetsX.push(item.x - 50, item.x, item.x + 50);
      targetsY.push(item.y - 50, item.y, item.y + 50);
    }

    let verticalGuide: number | null = null;
    let horizontalGuide: number | null = null;

    for (const target of targetsX) {
      for (const candidate of [x - halfWidth, x, x + halfWidth]) {
        const delta = target - candidate;
        if (Math.abs(delta) <= tolerance) {
          x += delta;
          verticalGuide = target;
          break;
        }
      }
      if (verticalGuide !== null) {
        break;
      }
    }

    for (const target of targetsY) {
      for (const candidate of [y - halfHeight, y, y + halfHeight]) {
        const delta = target - candidate;
        if (Math.abs(delta) <= tolerance) {
          y += delta;
          horizontalGuide = target;
          break;
        }
      }
      if (horizontalGuide !== null) {
        break;
      }
    }

    setAlignmentGuides({
      vertical: verticalGuide,
      horizontal: horizontalGuide,
    });

    return { x: clamp(x, width), y: clamp(y, height) };
  }

  function handleAlignDevice(id: string, x: number, y: number): FarmPoint {
    return alignDrag("device", id, x, y);
  }

  function handleAlignBackground(id: string, x: number, y: number): FarmPoint {
    return alignDrag("background", id, x, y);
  }

  function handleMoveDevice(id: string, x: number, y: number) {
    setAlignmentGuides({ vertical: null, horizontal: null });
    onMoveDevice(id, x, y);
  }

  function handleMoveBackground(id: string, x: number, y: number) {
    setAlignmentGuides({ vertical: null, horizontal: null });
    onMoveBackgroundItem(id, x, y);
  }

  function handlePortDragStart() {
    const point = stagePointerToContent(stageRef.current);
    draggingFlowRef.current = true;
    dragStartPointRef.current = point;
    setDraftPoint(point);
  }

  function handleFlowPointerUp(event: Konva.KonvaEventObject<MouseEvent | TouchEvent>) {
    if (!draggingFlowRef.current) {
      return;
    }

    draggingFlowRef.current = false;

    if (!linkMode || !linkSource) {
      return;
    }

    const point = stagePointerToContent(event.target.getStage());
    const start = dragStartPointRef.current;
    const port = event.target.findAncestor(".flow-port", true);
    const backgroundPort = event.target.findAncestor(".flow-background-port", true);
    const line = event.target.findAncestor(".flow-line", true);

    dragStartPointRef.current = null;

    if (
      (port || backgroundPort) &&
      start &&
      Math.abs(start.x - point.x) < 8 &&
      Math.abs(start.y - point.y) < 8
    ) {
      return;
    }

    if (port) {
      const portId = port.id() ?? "";
      const separatorIndex = portId.indexOf(":");
      const deviceId = separatorIndex === -1 ? "" : portId.slice(0, separatorIndex);
      const portName = separatorIndex === -1 ? "" : portId.slice(separatorIndex + 1);
      if (deviceId && isFarmDevicePort(portName)) {
        onSelect(deviceId, portName);
        return;
      }
    }

    if (backgroundPort) {
      const portId = backgroundPort.id() ?? "";
      const separatorIndex = portId.indexOf(":");
      const itemId = separatorIndex === -1 ? "" : portId.slice(0, separatorIndex);
      const side = separatorIndex === -1 ? "" : portId.slice(separatorIndex + 1);
      if (itemId && isFarmBackgroundPortSide(side)) {
        onSelectBackgroundItem(itemId, side);
        return;
      }
    }

    if (selectNearbyPort(point)) {
      return;
    }

    if (line?.id()) {
      onSelectFlowConnection(line.id(), point);
      return;
    }

    onCanvasFlowPoint(point);
  }

  function handleDrop(event: ReactDragEvent<HTMLDivElement>) {
    event.preventDefault();

    const deviceId = event.dataTransfer.getData("application/x-farm-device-id");
    const presetType = event.dataTransfer.getData(DEVICE_PRESET_DRAG_TYPE);
    const backgroundType = event.dataTransfer.getData(
      BACKGROUND_ITEM_DRAG_TYPE,
    );
    const isDevice = devicesById.has(deviceId);
    const isPreset = isFarmDevicePresetKey(presetType);
    const isBackgroundItem = FARM_BACKGROUND_ITEM_TYPES.includes(
      backgroundType as FarmBackgroundItemType,
    );

    if (!isDevice && !isPreset && !isBackgroundItem) {
      return;
    }

    const rect = event.currentTarget.getBoundingClientRect();
    const pointer = {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
    const x = clamp(snap((pointer.x - pan.x) / stageScale, snapToGrid), width);
    const y = clamp(snap((pointer.y - pan.y) / stageScale, snapToGrid), height);

    if (isDevice) {
      onAddDevice(deviceId, x, y);
      return;
    }

    if (isPreset) {
      onAddPreset(presetType as FarmDevicePresetKey, x, y);
      return;
    }

    onAddBackgroundItem(backgroundType as FarmBackgroundItemType, x, y);
  }

  function handleWheel(event: Konva.KonvaEventObject<WheelEvent>) {
    event.evt.preventDefault();

    const stage = stageRef.current;
    const pointer = stage?.getPointerPosition();

    if (!stage || !pointer) {
      return;
    }

    const direction = event.evt.deltaY > 0 ? -1 : 1;
    const nextZoom = clamp(zoom * (direction > 0 ? 1.1 : 1 / 1.1), 2.5);
    const boundedZoom = Math.max(0.5, nextZoom);
    const pointerToContent = {
      x: (pointer.x - pan.x) / stageScale,
      y: (pointer.y - pan.y) / stageScale,
    };
    const nextScale = fitScale * boundedZoom;

    setPan({
      x: pointer.x - pointerToContent.x * nextScale,
      y: pointer.y - pointerToContent.y * nextScale,
    });
    onZoomChange(Number(boundedZoom.toFixed(2)));
  }

  return (
    <div
      ref={containerRef}
      className="overflow-hidden rounded-xl border-2 border-emerald-500 bg-white dark:border-emerald-400 dark:bg-slate-950"
      style={linkMode ? { cursor: "crosshair" } : undefined}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
    >
      <Stage
        ref={stageRef}
        width={stageWidth}
        height={stageHeight}
        scaleX={stageScale}
        scaleY={stageScale}
        x={pan.x}
        y={pan.y}
        onWheel={handleWheel}
        onMouseDown={(event) => {
          const stage = event.target.getStage();

          if (!stage || event.target !== stage) {
            return;
          }

          if (linkMode) {
            const point = stagePointerToContent(stage);
            setDraftPoint(point);

            if (!selectNearbyPort(point)) {
              onCanvasFlowPoint(point);
            }
            return;
          }

          onSelect(null);
          onSelectBackgroundItem(null);
          onSelectConnection(null);
        }}
        onTouchStart={(event) => {
          const stage = event.target.getStage();

          if (!stage || event.target !== stage) {
            return;
          }

          if (linkMode) {
            const point = stagePointerToContent(stage);
            setDraftPoint(point);

            if (!selectNearbyPort(point)) {
              onCanvasFlowPoint(point);
            }
            return;
          }

          onSelect(null);
          onSelectBackgroundItem(null);
          onSelectConnection(null);
        }}
        onMouseMove={(event) => {
          if (linkMode) {
            const point = stagePointerToContent(event.target.getStage());

            if (linkSource) {
              setDraftPoint(point);
            }
          }
        }}
        onMouseUp={handleFlowPointerUp}
        onTouchEnd={handleFlowPointerUp}
      >
        <Layer>
          <Rect
            x={1}
            y={1}
            width={width - 2}
            height={height - 2}
            fill="#ffffff"
            listening={false}
          />
          {snapToGrid ? (
            <Group listening={false} opacity={0.18}>
              {Array.from({ length: Math.floor(width / FARM_LAYOUT_GRID) + 1 }).map(
                (_, index) => (
                  <Line
                    key={`vertical-${index}`}
                    points={[
                      index * FARM_LAYOUT_GRID,
                      0,
                      index * FARM_LAYOUT_GRID,
                      height,
                    ]}
                    stroke="#315f2c"
                    strokeWidth={1}
                  />
                ),
              )}
              {Array.from({ length: Math.floor(height / FARM_LAYOUT_GRID) + 1 }).map(
                (_, index) => (
                  <Line
                    key={`horizontal-${index}`}
                    points={[
                      0,
                      index * FARM_LAYOUT_GRID,
                      width,
                      index * FARM_LAYOUT_GRID,
                    ]}
                    stroke="#315f2c"
                    strokeWidth={1}
                  />
                ),
              )}
            </Group>
          ) : null}
          {alignmentGuides.vertical !== null ? (
            <Line
              points={[alignmentGuides.vertical, 0, alignmentGuides.vertical, height]}
              stroke="#ec4899"
              strokeWidth={1}
              dash={[6, 4]}
              listening={false}
            />
          ) : null}
          {alignmentGuides.horizontal !== null ? (
            <Line
              points={[0, alignmentGuides.horizontal, width, alignmentGuides.horizontal]}
              stroke="#ec4899"
              strokeWidth={1}
              dash={[6, 4]}
              listening={false}
            />
          ) : null}
          {previewSource && draftPoint ? (
            <ConnectionLine
              preview
              from={previewSource.point}
              to={draftPoint}
              waypoints={draftWaypoints}
              fromOffset={previewSource.offset}
              toOffset={0}
              selected={false}
              onSelect={() => undefined}
            />
          ) : null}
          {connections.map((connection) => {
            const source = resolveEndpoint(connection, "from");
            const target = resolveEndpoint(connection, "to");

            if (!source || !target) {
              return null;
            }

            return (
              <ConnectionLine
                key={connection.id}
                connectionId={connection.id}
                from={source.point}
                to={target.point}
                waypoints={connection.waypoints}
                fromOffset={source.offset}
                toOffset={target.offset}
                selected={selectedConnectionId === connection.id}
                onSelect={() => onSelectConnection(connection.id)}
                onSelectAt={
                  linkMode
                    ? (pointer) =>
                        onSelectFlowConnection(connection.id, toContent(pointer))
                    : undefined
                }
              />
            );
          })}
          {selectedConnection ? (
            <>
              {(selectedConnection.waypoints ?? []).map((point, index) => (
                <Circle
                  key={`waypoint-${index}`}
                  x={point.x}
                  y={point.y}
                  radius={7}
                  fill="#ffffff"
                  stroke="#dc2626"
                  strokeWidth={3}
                  draggable={!linkMode}
                  onDragEnd={(event) =>
                    onMoveWaypoint(selectedConnection.id, index, {
                      x: clamp(event.target.x(), width),
                      y: clamp(event.target.y(), height),
                    })
                  }
                />
              ))}
              {selectedConnection.fromPoint ? (
                <Circle
                  x={selectedConnection.fromPoint.x}
                  y={selectedConnection.fromPoint.y}
                  radius={6}
                  fill="#ffffff"
                  stroke="#0284c7"
                  strokeWidth={3}
                  draggable={!linkMode}
                  onDragEnd={(event) =>
                    onMoveFlowEndpoint(selectedConnection.id, "from", {
                      x: clamp(event.target.x(), width),
                      y: clamp(event.target.y(), height),
                    })
                  }
                />
              ) : null}
              {selectedConnection.toPoint ? (
                <Circle
                  x={selectedConnection.toPoint.x}
                  y={selectedConnection.toPoint.y}
                  radius={6}
                  fill="#ffffff"
                  stroke="#0284c7"
                  strokeWidth={3}
                  draggable={!linkMode}
                  onDragEnd={(event) =>
                    onMoveFlowEndpoint(selectedConnection.id, "to", {
                      x: clamp(event.target.x(), width),
                      y: clamp(event.target.y(), height),
                    })
                  }
                />
              ) : null}
            </>
          ) : null}
          {backgroundItems.map((item) => (
            <BackgroundItemNode
              key={item.id}
              item={item}
              selected={selectedBackgroundItemId === item.id}
              highlighted={
                linkSource?.kind === "backgroundItem" &&
                linkSource.backgroundItemId === item.id
              }
              linkSourcePort={
                linkSource?.kind === "backgroundItem"
                  ? linkSource.port ?? null
                  : null
              }
              draggable={!linkMode}
              snapToGrid={snapToGrid}
              onSelect={onSelectBackgroundItem}
              onPortDragStart={handlePortDragStart}
              onAlignDrag={handleAlignBackground}
              onMove={handleMoveBackground}
            />
          ))}
          {placements.map((placement) => {
            const device = devicesById.get(placement.deviceId);

            if (!device) {
              return null;
            }

            return (
              <DeviceNode
                key={placement.deviceId}
                device={device}
                placement={placement}
                selected={selectedDeviceId === placement.deviceId}
                highlighted={
                  linkSource?.kind === "device" &&
                  linkSource.deviceId === placement.deviceId
                }
                linkSourcePort={
                  linkSource?.kind === "device" ? linkSource.port ?? null : null
                }
                snapToGrid={snapToGrid}
                draggable={!linkMode}
                onSelect={onSelect}
                onPortDragStart={handlePortDragStart}
                onAlignDrag={handleAlignDevice}
                onMove={handleMoveDevice}
              />
            );
          })}
        </Layer>
      </Stage>
    </div>
  );
}
