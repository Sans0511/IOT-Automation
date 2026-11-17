"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import BackgroundInspector, {
  type BackgroundItemPatch,
} from "./BackgroundInspector";
import BackgroundPalette from "./BackgroundPalette";
import DevicePalette from "./DevicePalette";
import LayoutInspector, {
  type PlacementPatch,
} from "./LayoutInspector";
import {
  createFarmBackgroundItem,
  createFarmFlowConnection,
  createFarmPlacement,
  createPresetDevice,
  createPresetDeviceId,
  derivePresetDevices,
  FARM_CANVAS_HEIGHT,
  FARM_CANVAS_WIDTH,
  FARM_BACKGROUND_LABELS,
  FARM_DEVICE_PORT_LABELS,
  type FarmBackgroundItemType,
  type FarmDevicePort,
  type FarmDevicePresetKey,
  type FarmFlowEndpointRef,
  type FarmPoint,
  type FarmLayoutBackgroundItem,
  type FarmLayoutConnection,
  type FarmLayoutData,
  type FarmLayoutDevice,
  type FarmLayoutPlacement,
} from "@/lib/farm-layout";

type LayoutClipboard =
  | {
      kind: "device";
      placement: FarmLayoutPlacement;
      device: FarmLayoutDevice;
    }
  | { kind: "background"; item: FarmLayoutBackgroundItem };

const FarmCanvas = dynamic(() => import("./FarmCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[520px] items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-400">
      Loading farm canvas...
    </div>
  ),
});

function clamp(value: number, max: number): number {
  return Math.min(max, Math.max(0, Math.round(value)));
}

function normalizeRotation(value: number): number {
  const normalized = Math.round(value) % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export default function FarmLayoutEditor({
  farmId,
  devices,
  initialLayout,
}: {
  farmId: string;
  devices: FarmLayoutDevice[];
  initialLayout: FarmLayoutData;
}) {
  const [layout, setLayout] = useState(initialLayout);
  const [presetDevices, setPresetDevices] = useState<FarmLayoutDevice[]>(() =>
    derivePresetDevices(initialLayout.placements, devices),
  );
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedBackgroundItemId, setSelectedBackgroundItemId] = useState<
    string | null
  >(null);
  const [selectedConnectionId, setSelectedConnectionId] = useState<
    string | null
  >(null);
  const [linkMode, setLinkMode] = useState(false);
  const [linkSource, setLinkSource] = useState<FarmFlowEndpointRef | null>(null);
  const [draftWaypoints, setDraftWaypoints] = useState<FarmPoint[]>([]);
  const [clipboard, setClipboard] = useState<LayoutClipboard | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [snapToGrid, setSnapToGrid] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [panResetKey, setPanResetKey] = useState(0);

  useEffect(() => {
    if (!isDirty) {
      return;
    }

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  const allDevices = useMemo(
    () => [...devices, ...presetDevices],
    [devices, presetDevices],
  );
  const devicesById = useMemo(
    () => new Map(allDevices.map((device) => [device.id, device])),
    [allDevices],
  );
  const selectedDevice = selectedDeviceId
    ? devicesById.get(selectedDeviceId) ?? null
    : null;
  const selectedPlacement = layout.placements.find(
    (placement) => placement.deviceId === selectedDeviceId,
  ) ?? null;
  const selectedBackgroundItem =
    layout.backgroundItems.find(
      (item) => item.id === selectedBackgroundItemId,
    ) ?? null;
  const selectedConnection =
    layout.connections.find((connection) => connection.id === selectedConnectionId) ??
    null;

  function sameFlowEndpoint(
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
      return left.backgroundItemId === right.backgroundItemId;
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

  function connectionLabel(
    connection: FarmLayoutConnection,
    side: "from" | "to",
  ): string {
    const id =
      side === "from" ? connection.fromDeviceId : connection.toDeviceId;
    const backgroundId =
      side === "from"
        ? connection.fromBackgroundItemId
        : connection.toBackgroundItemId;
    const connectionId =
      side === "from"
        ? connection.fromConnectionId
        : connection.toConnectionId;
    const point =
      side === "from" ? connection.fromPoint : connection.toPoint;

    if (id) {
      return devicesById.get(id)?.name ?? "Unknown device";
    }

    if (backgroundId) {
      const item = layout.backgroundItems.find(
        (backgroundItem) => backgroundItem.id === backgroundId,
      );
      return item ? FARM_BACKGROUND_LABELS[item.type] : "Removed item";
    }

    if (connectionId) {
      return "Another flow line";
    }

    return point ? `Point (${point.x}, ${point.y})` : "Free end";
  }

  function endpointOfConnection(
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

  function handleSelectDevice(deviceId: string | null) {
    setSelectedDeviceId(deviceId);
    setSelectedBackgroundItemId(null);
    setSelectedConnectionId(null);
  }

  function handleSelectBackgroundItem(itemId: string | null) {
    setSelectedBackgroundItemId(itemId);
    setSelectedDeviceId(null);
    setSelectedConnectionId(null);
  }

  function handleSelectConnection(connectionId: string | null) {
    setSelectedConnectionId(connectionId);
    setSelectedDeviceId(null);
    setSelectedBackgroundItemId(null);
    setLinkSource(null);
    setDraftWaypoints([]);
  }

  function cancelFlow() {
    setLinkSource(null);
    setDraftWaypoints([]);
    setMessage("Flow drawing canceled.");
    setError(null);
  }

  function finishFlow(target: FarmFlowEndpointRef) {
    if (!linkSource) {
      return;
    }

    if (sameFlowEndpoint(linkSource, target)) {
      setMessage("Pick a different end point for this flow.");
      return;
    }

    const alreadyLinked = layout.connections.some((connection) => {
      const from = endpointOfConnection(connection, "from");
      const to = endpointOfConnection(connection, "to");
      return (
        from !== null &&
        to !== null &&
        sameFlowEndpoint(from, linkSource) &&
        sameFlowEndpoint(to, target)
      );
    });

    if (alreadyLinked) {
      setMessage("These points are already linked.");
    } else {
      setLayout((current) => ({
        ...current,
        connections: [
          ...current.connections,
          createFarmFlowConnection(linkSource, target, draftWaypoints),
        ],
      }));
      setIsDirty(true);
      setMessage("Flow linked.");
      setError(null);
    }

    setLinkSource(null);
    setDraftWaypoints([]);
    setLinkMode(false);
  }

  function startOrFinishFlow(endpoint: FarmFlowEndpointRef) {
    if (!linkSource) {
      setLinkSource(endpoint);
      setDraftWaypoints([]);
      setMessage(
        "Start set. Click empty canvas to add bends, then click the end point — or double-click / press Enter to end at a free point.",
      );
      setError(null);
      return;
    }

    finishFlow(endpoint);
  }

  function handleCanvasSelectDevice(
    deviceId: string | null,
    port?: FarmDevicePort,
  ) {
    if (!linkMode) {
      handleSelectDevice(deviceId);
      return;
    }

    if (!deviceId) {
      cancelFlow();
      return;
    }

    startOrFinishFlow({
      kind: "device",
      deviceId,
      ...(port ? { port } : {}),
    });
  }

  function handleCanvasSelectBackgroundItem(itemId: string | null) {
    if (!linkMode) {
      handleSelectBackgroundItem(itemId);
      return;
    }

    if (!itemId) {
      cancelFlow();
      return;
    }

    startOrFinishFlow({ kind: "backgroundItem", backgroundItemId: itemId });
  }

  function handleCanvasFlowPoint(point: FarmPoint) {
    if (!linkMode) {
      return;
    }

    if (!linkSource) {
      startOrFinishFlow({ kind: "point", point });
      return;
    }

    const lastPoint =
      draftWaypoints[draftWaypoints.length - 1] ??
      (linkSource.kind === "point" ? linkSource.point : null);

    if (
      lastPoint &&
      Math.abs(lastPoint.x - point.x) < 2 &&
      Math.abs(lastPoint.y - point.y) < 2
    ) {
      return;
    }

    setDraftWaypoints((current) => [...current, point]);
    setMessage(
      `Bend point ${draftWaypoints.length + 1} added. Click the end point, or double-click / press Enter to finish at a free point.`,
    );
  }

  function handleSelectFlowConnection(connectionId: string, point: FarmPoint) {
    if (!linkMode) {
      handleSelectConnection(connectionId);
      return;
    }

    startOrFinishFlow({ kind: "connection", connectionId, point });
  }

  function handleFinishFlow(point: FarmPoint) {
    if (!linkSource) {
      setMessage("Click a starting point first.");
      return;
    }

    finishFlow({ kind: "point", point });
  }

  function handleMoveWaypoint(
    connectionId: string,
    index: number,
    point: FarmPoint,
  ) {
    setLayout((current) => ({
      ...current,
      connections: current.connections.map((connection) => {
        if (connection.id !== connectionId || !connection.waypoints) {
          return connection;
        }

        const waypoints = [...connection.waypoints];
        waypoints[index] = point;
        return { ...connection, waypoints };
      }),
    }));
    setIsDirty(true);
  }

  function handleMoveFlowEndpoint(
    connectionId: string,
    side: "from" | "to",
    point: FarmPoint,
  ) {
    setLayout((current) => ({
      ...current,
      connections: current.connections.map((connection) =>
        connection.id === connectionId
          ? side === "from"
            ? { ...connection, fromPoint: point }
            : { ...connection, toPoint: point }
          : connection,
      ),
    }));
    setIsDirty(true);
  }

  function handleAddDevice(deviceId: string, x: number, y: number) {
    const alreadyPlaced = layout.placements.some(
      (placement) => placement.deviceId === deviceId,
    );

    handleSelectDevice(deviceId);

    if (alreadyPlaced) {
      setMessage("This device is already on the canvas.");
      return;
    }

    setLayout((current) => ({
      ...current,
      placements: [
        ...current.placements,
        createFarmPlacement(deviceId, x, y),
      ],
    }));
    setIsDirty(true);
    setMessage(null);
    setError(null);
  }

  function handleAddPreset(presetKey: FarmDevicePresetKey, x: number, y: number) {
    const deviceId = createPresetDeviceId();

    setPresetDevices((current) => [
      ...current,
      createPresetDevice(deviceId, presetKey),
    ]);
    setLayout((current) => ({
      ...current,
      placements: [
        ...current.placements,
        createFarmPlacement(deviceId, x, y, presetKey),
      ],
    }));
    handleSelectDevice(deviceId);
    setIsDirty(true);
    setMessage(null);
    setError(null);
  }

  function handleMoveDevice(deviceId: string, x: number, y: number) {
    setLayout((current) => ({
      ...current,
      placements: current.placements.map((placement) =>
        placement.deviceId === deviceId
          ? {
              ...placement,
              x: clamp(x, current.width),
              y: clamp(y, current.height),
            }
          : placement,
      ),
    }));
    setIsDirty(true);
    setMessage(null);
    setError(null);
  }

  function handleRemoveDevice(deviceId: string) {
    setLayout((current) => ({
      ...current,
      placements: current.placements.filter(
        (placement) => placement.deviceId !== deviceId,
      ),
      connections: current.connections.filter(
        (connection) =>
          connection.fromDeviceId !== deviceId &&
          connection.toDeviceId !== deviceId,
      ),
    }));
    setPresetDevices((current) => current.filter((device) => device.id !== deviceId));
    setSelectedDeviceId(null);
    setIsDirty(true);
    setMessage(null);
    setError(null);
  }

  function handlePatchPlacement(patch: PlacementPatch) {
    if (!selectedDeviceId) {
      return;
    }

    setLayout((current) => ({
      ...current,
      placements: current.placements.map((placement) => {
        if (placement.deviceId !== selectedDeviceId) {
          return placement;
        }

        const next: FarmLayoutPlacement = { ...placement };

        if (patch.x !== undefined && Number.isFinite(patch.x)) {
          next.x = clamp(patch.x, current.width);
        }

        if (patch.y !== undefined && Number.isFinite(patch.y)) {
          next.y = clamp(patch.y, current.height);
        }

        if (patch.rotation !== undefined && Number.isFinite(patch.rotation)) {
          next.rotation = normalizeRotation(patch.rotation);
        }

        if (patch.label !== undefined) {
          next.label = patch.label;
        }

        return next;
      }),
    }));
    setIsDirty(true);
    setMessage(null);
    setError(null);
  }

  function handleAddBackgroundItem(
    type: FarmBackgroundItemType,
    x: number,
    y: number,
  ) {
    if (layout.backgroundItems.length >= 200) {
      setError("This layout already has the maximum number of background items.");
      return;
    }

    const item = createFarmBackgroundItem(type, x, y);

    setLayout((current) => ({
      ...current,
      backgroundItems: [...current.backgroundItems, item],
    }));
    handleSelectBackgroundItem(item.id);
    setIsDirty(true);
    setMessage(null);
    setError(null);
  }

  function handleMoveBackgroundItem(id: string, x: number, y: number) {
    setLayout((current) => ({
      ...current,
      backgroundItems: current.backgroundItems.map((item) =>
        item.id === id
          ? {
              ...item,
              x: clamp(x, current.width),
              y: clamp(y, current.height),
            }
          : item,
      ),
    }));
    setIsDirty(true);
    setMessage(null);
    setError(null);
  }

  const handleCopySelection = useCallback(() => {
    if (selectedDeviceId && selectedPlacement) {
      const device = devicesById.get(selectedDeviceId);

      if (!device || !selectedPlacement.presetKey) {
        setMessage("Only devices added from the palette can be copied.");
        return;
      }

      setClipboard({
        kind: "device",
        placement: selectedPlacement,
        device,
      });
      setMessage(`${device.name} copied.`);
      setError(null);
      return;
    }

    if (selectedBackgroundItem) {
      setClipboard({ kind: "background", item: selectedBackgroundItem });
      setMessage(
        `${FARM_BACKGROUND_LABELS[selectedBackgroundItem.type]} copied.`,
      );
      setError(null);
    }
  }, [selectedDeviceId, selectedPlacement, devicesById, selectedBackgroundItem]);

  const handlePasteClipboard = useCallback(() => {
    if (!clipboard) {
      return;
    }

    const offset = 40;

    if (clipboard.kind === "device") {
      const presetKey = clipboard.placement.presetKey;

      if (!presetKey) {
        setMessage("This device cannot be pasted.");
        return;
      }

      const deviceId = createPresetDeviceId();
      const placement: FarmLayoutPlacement = {
        ...clipboard.placement,
        deviceId,
        x: clamp(clipboard.placement.x + offset, layout.width),
        y: clamp(clipboard.placement.y + offset, layout.height),
      };

      setPresetDevices((current) => [
        ...current,
        createPresetDevice(deviceId, presetKey),
      ]);
      setLayout((current) => ({
        ...current,
        placements: [...current.placements, placement],
      }));
      setSelectedDeviceId(deviceId);
      setSelectedBackgroundItemId(null);
      setSelectedConnectionId(null);
      setMessage(`${clipboard.device.name} pasted.`);
    } else {
      const source = clipboard.item;
      const item: FarmLayoutBackgroundItem = {
        ...createFarmBackgroundItem(
          source.type,
          clamp(source.x + offset, layout.width),
          clamp(source.y + offset, layout.height),
        ),
        rotation: source.rotation,
        scale: source.scale,
      };

      setLayout((current) => ({
        ...current,
        backgroundItems: [...current.backgroundItems, item],
      }));
      setSelectedDeviceId(null);
      setSelectedBackgroundItemId(item.id);
      setSelectedConnectionId(null);
      setMessage(`${FARM_BACKGROUND_LABELS[source.type]} pasted.`);
    }

    setIsDirty(true);
    setError(null);
  }, [clipboard, layout.width, layout.height]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;

      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (!event.metaKey && !event.ctrlKey) {
        return;
      }

      if (event.key.toLowerCase() === "c") {
        event.preventDefault();
        handleCopySelection();
      }

      if (event.key.toLowerCase() === "v") {
        event.preventDefault();
        handlePasteClipboard();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleCopySelection, handlePasteClipboard]);

  function handlePatchBackgroundItem(patch: BackgroundItemPatch) {
    if (!selectedBackgroundItemId) {
      return;
    }

    setLayout((current) => ({
      ...current,
      backgroundItems: current.backgroundItems.map((item) => {
        if (item.id !== selectedBackgroundItemId) {
          return item;
        }

        const next: FarmLayoutBackgroundItem = { ...item };

        if (patch.x !== undefined && Number.isFinite(patch.x)) {
          next.x = clamp(patch.x, current.width);
        }

        if (patch.y !== undefined && Number.isFinite(patch.y)) {
          next.y = clamp(patch.y, current.height);
        }

        if (patch.rotation !== undefined && Number.isFinite(patch.rotation)) {
          next.rotation = normalizeRotation(patch.rotation);
        }

        if (patch.scale !== undefined && Number.isFinite(patch.scale)) {
          next.scale = Number(Math.min(2, Math.max(0.5, patch.scale)).toFixed(2));
        }

        return next;
      }),
    }));
    setIsDirty(true);
    setMessage(null);
    setError(null);
  }

  function handleRemoveBackgroundItem() {
    if (!selectedBackgroundItemId) {
      return;
    }

    setLayout((current) => ({
      ...current,
      backgroundItems: current.backgroundItems.filter(
        (item) => item.id !== selectedBackgroundItemId,
      ),
      connections: current.connections.filter(
        (connection) =>
          connection.toBackgroundItemId !== selectedBackgroundItemId &&
          connection.fromBackgroundItemId !== selectedBackgroundItemId,
      ),
    }));
    handleSelectBackgroundItem(null);
    setIsDirty(true);
    setMessage(null);
    setError(null);
  }

  function handleRotateSelected(delta: number) {
    if (selectedDeviceId && selectedPlacement) {
      handlePatchPlacement({
        rotation: selectedPlacement.rotation + delta,
      });
      return;
    }

    if (selectedBackgroundItem) {
      handlePatchBackgroundItem({
        rotation: selectedBackgroundItem.rotation + delta,
      });
    }
  }

  function handleDeleteSelected() {
    if (selectedConnectionId) {
      setLayout((current) => ({
        ...current,
        connections: current.connections.filter(
          (connection) =>
            connection.id !== selectedConnectionId &&
            connection.fromConnectionId !== selectedConnectionId &&
            connection.toConnectionId !== selectedConnectionId,
        ),
      }));
      setSelectedConnectionId(null);
      setIsDirty(true);
      setMessage(null);
      setError(null);
      return;
    }

    if (selectedDeviceId) {
      handleRemoveDevice(selectedDeviceId);
      return;
    }

    if (selectedBackgroundItemId) {
      handleRemoveBackgroundItem();
    }
  }

  async function handleSave() {
    console.log("[FarmLayoutEditor] Saving layout", {
      farmId,
      placements: layout.placements,
      connections: layout.connections,
    });
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/farms/${farmId}/layout`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({
          version: layout.version,
          backgroundKey: layout.backgroundKey,
          width: layout.width,
          height: layout.height,
          placements: layout.placements,
          backgroundItems: layout.backgroundItems,
          connections: layout.connections,
        }),
      });
      const data = (await response.json()) as {
        layout?: FarmLayoutData;
        error?: string;
      };

      if (!response.ok || !data.layout) {
        setError(data.error ?? "Unable to save layout");
        return;
      }

      setLayout(data.layout);
      setIsDirty(false);
      setMessage("Layout saved successfully.");
    } catch {
      setError("Network error while saving layout");
    } finally {
      setSaving(false);
    }
  }

  async function handleReload() {
    if (isDirty && !window.confirm("Discard unsaved layout changes?")) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      const response = await fetch(`/api/admin/farms/${farmId}/layout`, {
        credentials: "same-origin",
      });
      const data = (await response.json()) as {
        layout?: FarmLayoutData;
        error?: string;
      };

      if (!response.ok || !data.layout) {
        setError(data.error ?? "Unable to reload layout");
        return;
      }

      setLayout(data.layout);
      setPresetDevices(derivePresetDevices(data.layout.placements, devices));
      handleSelectDevice(null);
      setLinkMode(false);
      setLinkSource(null);
      setDraftWaypoints([]);
      setIsDirty(false);
      setZoom(1);
      setPanResetKey((current) => current + 1);
      setMessage("Saved layout reloaded.");
    } catch {
      setError("Network error while reloading layout");
    }
  }

  function handleClear() {
    if (!layout.placements.length && !layout.backgroundItems.length) {
      return;
    }

    if (
      !window.confirm("Remove every device and background item from this layout?")
    ) {
      return;
    }

    setLayout((current) => ({
      ...current,
      placements: [],
      backgroundItems: [],
      connections: [],
    }));
    setPresetDevices([]);
    handleSelectDevice(null);
    setLinkMode(false);
    setLinkSource(null);
    setDraftWaypoints([]);
    setIsDirty(true);
    setMessage(null);
    setError(null);
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                isDirty
                  ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
                  : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
              }`}
            >
              {isDirty ? "Unsaved changes" : "Saved"}
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">
              {layout.placements.length} device
              {layout.placements.length === 1 ? "" : "s"} ·{" "}
              {layout.backgroundItems.length} background item
              {layout.backgroundItems.length === 1 ? "" : "s"} ·{" "}
              {layout.connections.length} link
              {layout.connections.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setSnapToGrid((current) => !current)}
              className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                snapToGrid
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                  : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300"
              }`}
            >
              Snap: {snapToGrid ? "On" : "Off"}
            </button>
            <button
              type="button"
              onClick={handleCopySelection}
              disabled={
                !(
                  (selectedDeviceId && selectedPlacement?.presetKey) ||
                  selectedBackgroundItem
                )
              }
              title="Copy selected device or background item (Ctrl/Cmd+C)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Copy
            </button>
            <button
              type="button"
              onClick={handlePasteClipboard}
              disabled={!clipboard}
              title="Paste copied item (Ctrl/Cmd+V)"
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Paste
            </button>
            <button
              type="button"
                onClick={() => {
                  setLinkMode((current) => !current);
                  setLinkSource(null);
                  setDraftWaypoints([]);
                  setSelectedConnectionId(null);
                }}
                className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
                  linkMode
                    ? "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                    : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300"
                }`}
              >
                {linkMode ? "Drawing flow" : "Draw flow"}
              </button>
              {linkMode && linkSource ? (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const last =
                        draftWaypoints[draftWaypoints.length - 1];
                      if (last) {
                        handleFinishFlow(last);
                      } else {
                        setMessage(
                          "Click the canvas to choose an end point, or press Enter.",
                        );
                      }
                    }}
                    className="rounded-lg border border-sky-300 px-3 py-2 text-xs font-medium text-sky-700 transition hover:bg-sky-50 dark:border-sky-700 dark:text-sky-300 dark:hover:bg-sky-950/40"
                  >
                    Finish here
                  </button>
                  <button
                    type="button"
                    onClick={cancelFlow}
                    className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                  >
                    Cancel flow
                  </button>
                </>
              ) : null}
            <button
              type="button"
              onClick={() => setZoom((current) => Math.min(2.5, current + 0.1))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Zoom in
            </button>
            <button
              type="button"
              onClick={() => setZoom((current) => Math.max(0.5, current - 0.1))}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Zoom out
            </button>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setPanResetKey((current) => current + 1);
              }}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Fit
            </button>
            <button
              type="button"
              onClick={() => handleRotateSelected(-15)}
              disabled={!selectedDeviceId && !selectedBackgroundItemId}
              title="Rotate selected item 15 degrees counter-clockwise"
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Rotate -15°
            </button>
            <button
              type="button"
              onClick={() => handleRotateSelected(15)}
              disabled={!selectedDeviceId && !selectedBackgroundItemId}
              title="Rotate selected item 15 degrees clockwise"
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Rotate +15°
            </button>
            <button
              type="button"
              onClick={handleDeleteSelected}
              disabled={
                !selectedDeviceId &&
                !selectedBackgroundItemId &&
                !selectedConnectionId
              }
              title="Delete selected item"
              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              Delete selected
            </button>
            <button
              type="button"
              onClick={() => void handleReload()}
              className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Reload
            </button>
            <button
              type="button"
              onClick={handleClear}
              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || !isDirty}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save layout"}
            </button>
          </div>
        </div>

        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Drag irrigation presets, farm devices, or scenery from the left panel
          onto the canvas. While dragging, items snap-align to other items with
          pink guides. Select an item to edit its position, label, or
          rotation, or use the toolbar to rotate/delete it. With Draw flow on,
          drag from a device port and drop on a target, or click a start point
          (device/port, background item, empty canvas, or an existing flow
          line), click empty canvas to add bends, then click the end point — or
          double-click / press Enter to end at a free point. Select a line to
          drag its waypoints and endpoints. Copy/Paste (or Ctrl/Cmd+C and
          Ctrl/Cmd+V) duplicates the selected palette device or background item.
        </p>

        {error ? (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
            {error}
          </p>
        ) : null}

        {message ? (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
            {message}
          </p>
        ) : null}
      </section>

      <div className="grid gap-6 xl:grid-cols-[220px_minmax(0,1fr)_240px]">
        <div className="space-y-6">
          <DevicePalette
            devices={allDevices}
            placements={layout.placements}
            onSelect={handleSelectDevice}
            onRemove={handleRemoveDevice}
            onAddPreset={(presetKey) => {
              const count = layout.placements.filter(
                (placement) => placement.presetKey === presetKey,
              ).length;
              handleAddPreset(presetKey, 120 + count * 40, 120 + count * 40);
            }}
          />
          <BackgroundPalette />
        </div>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Farm canvas
              </h2>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {FARM_CANVAS_WIDTH} x {FARM_CANVAS_HEIGHT} layout grid
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {Math.round(zoom * 100)}%
            </span>
          </div>

          <FarmCanvas
            key={`canvas-${panResetKey}`}
            width={layout.width}
            height={layout.height}
            devices={allDevices}
            placements={layout.placements}
            backgroundItems={layout.backgroundItems}
            connections={layout.connections}
            selectedDeviceId={selectedDeviceId}
            selectedBackgroundItemId={selectedBackgroundItemId}
            selectedConnectionId={selectedConnectionId}
            linkMode={linkMode}
            linkSource={linkSource}
            draftWaypoints={draftWaypoints}
            snapToGrid={snapToGrid}
            zoom={zoom}
            onSelect={handleCanvasSelectDevice}
            onSelectConnection={handleSelectConnection}
            onCanvasFlowPoint={handleCanvasFlowPoint}
            onFinishFlow={handleFinishFlow}
            onCancelFlow={cancelFlow}
            onSelectFlowConnection={handleSelectFlowConnection}
            onMoveWaypoint={handleMoveWaypoint}
            onMoveFlowEndpoint={handleMoveFlowEndpoint}
            onAddDevice={handleAddDevice}
            onAddPreset={handleAddPreset}
            onMoveDevice={handleMoveDevice}
            onSelectBackgroundItem={handleCanvasSelectBackgroundItem}
            onAddBackgroundItem={handleAddBackgroundItem}
            onMoveBackgroundItem={handleMoveBackgroundItem}
            onZoomChange={setZoom}
          />
        </section>

        {selectedConnection ? (
          <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Connection
            </h2>
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              {connectionLabel(selectedConnection, "from")}
              <span className="mx-2 text-sky-600 dark:text-sky-400">→</span>
              {connectionLabel(selectedConnection, "to")}
            </p>
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              {selectedConnection.fromPort
                ? FARM_DEVICE_PORT_LABELS[selectedConnection.fromPort]
                : selectedConnection.fromConnectionId
                  ? "On flow line"
                  : selectedConnection.fromPoint
                    ? "Free point"
                    : "Center"}
              <span className="mx-2">→</span>
              {selectedConnection.toPort
                ? FARM_DEVICE_PORT_LABELS[selectedConnection.toPort]
                : selectedConnection.toConnectionId
                  ? "On flow line"
                  : selectedConnection.toPoint
                    ? "Free point"
                    : "Center"}
            </p>
            <button
              type="button"
              onClick={handleDeleteSelected}
              className="mt-5 w-full rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              Remove link
            </button>
          </aside>
        ) : selectedBackgroundItem ? (
          <BackgroundInspector
            item={selectedBackgroundItem}
            onChange={handlePatchBackgroundItem}
            onRemove={handleRemoveBackgroundItem}
          />
        ) : (
          <LayoutInspector
            device={selectedDevice}
            placement={selectedPlacement}
            onChange={handlePatchPlacement}
            onRemove={() =>
              selectedDeviceId ? handleRemoveDevice(selectedDeviceId) : undefined
            }
          />
        )}
      </div>
    </div>
  );
}
