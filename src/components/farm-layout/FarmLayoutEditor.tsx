"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import BackgroundPalette from "./BackgroundPalette";
import DevicePalette from "./DevicePalette";
import EditorToolbar from "./EditorToolbar";
import { endpointOfConnection, sameFlowEndpoint } from "./flow-utils";
import {
  buildLayoutPayload,
  reloadFarmLayout,
  saveFarmLayout,
} from "./layout-api";
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
  findNearbyFarmFlowPort,
  type FarmBackgroundItemType,
  type FarmBackgroundPortSide,
  type FarmDevicePort,
  type FarmDevicePresetKey,
  type FarmFlowEndpointRef,
  type FarmPoint,
  type BackgroundItemPatch,
  type FarmLayoutBackgroundItem,
  type FarmLayoutData,
  type FarmLayoutDevice,
  type FarmLayoutPlacement,
  type PlacementPatch,
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
  const [publishing, setPublishing] = useState(false);
  const [publishedDevices, setPublishedDevices] = useState<
    FarmLayoutDevice[]
  >([]);
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
    () => [...devices, ...publishedDevices, ...presetDevices],
    [devices, publishedDevices, presetDevices],
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

  function snapFlowEndpoint(endpoint: FarmFlowEndpointRef): FarmFlowEndpointRef {
    if (endpoint.kind !== "point") {
      return endpoint;
    }

    const nearbyPort = findNearbyFarmFlowPort(
      endpoint.point,
      layout.placements,
      allDevices,
      layout.backgroundItems,
    );

    if (!nearbyPort) {
      return endpoint;
    }

    return nearbyPort.kind === "device"
      ? {
          kind: "device",
          deviceId: nearbyPort.deviceId,
          port: nearbyPort.port,
        }
      : {
          kind: "backgroundItem",
          backgroundItemId: nearbyPort.backgroundItemId,
          port: nearbyPort.port,
        };
  }

  function isPortEndpoint(endpoint: FarmFlowEndpointRef): boolean {
    if (endpoint.kind === "device") {
      return Boolean(endpoint.port);
    }
    if (endpoint.kind === "backgroundItem") {
      return Boolean(endpoint.port);
    }
    if (endpoint.kind === "connection") {
      return Boolean(endpoint.connectionId && endpoint.point);
    }
    return false;
  }

  function finishFlow(target: FarmFlowEndpointRef) {
    if (!linkSource) {
      return;
    }

    const resolvedSource = snapFlowEndpoint(linkSource);
    const resolvedTarget = snapFlowEndpoint(target);

    if (!isPortEndpoint(resolvedSource) || !isPortEndpoint(resolvedTarget)) {
      setMessage("Flows must attach to ports or an existing flow line.");
      setError(null);
      return;
    }

    if (sameFlowEndpoint(resolvedSource, resolvedTarget)) {
      setMessage("Pick a different end port for this flow.");
      return;
    }

    const alreadyLinked = layout.connections.some((connection) => {
      const from = endpointOfConnection(connection, "from");
      const to = endpointOfConnection(connection, "to");
      return (
        from !== null &&
        to !== null &&
        sameFlowEndpoint(from, resolvedSource) &&
        sameFlowEndpoint(to, resolvedTarget)
      );
    });

    if (alreadyLinked) {
      setMessage("These ports are already linked.");
    } else {
      setLayout((current) => ({
        ...current,
        connections: [
          ...current.connections,
          createFarmFlowConnection(resolvedSource, resolvedTarget, draftWaypoints),
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
    const resolved = snapFlowEndpoint(endpoint);

    if (!isPortEndpoint(resolved)) {
      setMessage("Flows must attach to ports or an existing flow line.");
      setError(null);
      return;
    }

    if (!linkSource) {
      setLinkSource(resolved);
      setDraftWaypoints([]);
      setMessage(
        "Start set. Click empty canvas to add bends, then click an end port or flow line.",
      );
      setError(null);
      return;
    }

    finishFlow(resolved);
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

  function handleCanvasSelectBackgroundItem(
    itemId: string | null,
    port?: FarmBackgroundPortSide,
  ) {
    if (!linkMode) {
      handleSelectBackgroundItem(itemId);
      return;
    }

    if (!itemId) {
      cancelFlow();
      return;
    }

    startOrFinishFlow({
      kind: "backgroundItem",
      backgroundItemId: itemId,
      ...(port ? { port } : {}),
    });
  }

  function handleCanvasFlowPoint(point: FarmPoint) {
    if (!linkMode) {
      return;
    }

    if (!linkSource) {
      setMessage("Start the flow by clicking a port or an existing flow line.");
      setError(null);
      return;
    }

    const lastPoint = draftWaypoints[draftWaypoints.length - 1];

    if (
      lastPoint &&
      Math.abs(lastPoint.x - point.x) < 2 &&
      Math.abs(lastPoint.y - point.y) < 2
    ) {
      return;
    }

    setDraftWaypoints((current) => [...current, point]);
    setMessage(
      `Bend point ${draftWaypoints.length + 1} added. Click an end port or flow line.`,
    );
  }

  function handleSelectFlowConnection(connectionId: string, point: FarmPoint) {
    if (!linkMode) {
      handleSelectConnection(connectionId);
      return;
    }

    startOrFinishFlow({ kind: "connection", connectionId, point });
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
    setSaving(true);
    setError(null);
    setMessage(null);

    try {
      const result = await saveFarmLayout(farmId, buildLayoutPayload(layout));

      if (result.networkError) {
        setError("Network error while saving layout");
        return;
      }

      if (!result.ok || !result.layout) {
        setError(
          result.status === 401
            ? "Your session expired. Please sign in again."
            : (result.error ?? "Unable to save layout"),
        );
        return;
      }

      setLayout(result.layout);
      setIsDirty(false);
      setMessage("Layout saved successfully.");
    } catch {
      setError("Network error while saving layout");
    } finally {
      setSaving(false);
    }
  }

  async function handlePublish() {
    const presetCount = layout.placements.filter(
      (placement) => placement.presetKey,
    ).length;
    const confirmMessage = presetCount
      ? `Publish ${presetCount} layout device(s) to this farm?`
      : "Publish this layout?";

    if (!window.confirm(confirmMessage)) {
      return;
    }

    setPublishing(true);
    setError(null);
    setMessage(null);

    try {
      const result = await saveFarmLayout(
        farmId,
        buildLayoutPayload(layout, true),
      );

      if (result.networkError) {
        setError("Network error while publishing layout");
        return;
      }

      if (!result.ok || !result.layout) {
        setError(
          result.status === 401
            ? "Your session expired. Please sign in again."
            : (result.error ?? "Unable to publish layout"),
        );
        return;
      }

      const newDevices = result.publishedDevices;
      const realDevices = [...devices, ...publishedDevices, ...newDevices];

      setPublishedDevices(realDevices.filter((device) => !devices.some((existing) => existing.id === device.id)));
      setPresetDevices(derivePresetDevices(result.layout.placements, realDevices));
      setLayout(result.layout);
      handleSelectDevice(null);
      setIsDirty(false);
      setMessage(
        newDevices.length
          ? `Published ${newDevices.length} device(s) to this farm.`
          : "Layout published successfully.",
      );
    } catch {
      setError("Network error while publishing layout");
    } finally {
      setPublishing(false);
    }
  }

  async function handleReload() {
    if (isDirty && !window.confirm("Discard unsaved layout changes?")) {
      return;
    }

    setError(null);
    setMessage(null);

    try {
      const result = await reloadFarmLayout(farmId);

      if (result.networkError) {
        setError("Network error while reloading layout");
        return;
      }

      if (!result.ok || !result.layout) {
        setError(result.error ?? "Unable to reload layout");
        return;
      }

      setLayout(result.layout);
      setPresetDevices(
        derivePresetDevices(result.layout.placements, [
          ...devices,
          ...publishedDevices,
        ]),
      );
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

  function toggleLinkMode() {
    setLinkMode((current) => !current);
    setLinkSource(null);
    setDraftWaypoints([]);
    setSelectedConnectionId(null);
  }

  return (
    <div className="space-y-6">
      <EditorToolbar
        isDirty={isDirty}
        placementCount={layout.placements.length}
        backgroundItemCount={layout.backgroundItems.length}
        connectionCount={layout.connections.length}
        snapToGrid={snapToGrid}
        canCopy={Boolean(
          (selectedDeviceId && selectedPlacement?.presetKey) ||
            selectedBackgroundItem,
        )}
        canPaste={Boolean(clipboard)}
        linkMode={linkMode}
        hasLinkSource={Boolean(linkSource)}
        canRotate={Boolean(selectedDeviceId || selectedBackgroundItemId)}
        canDelete={Boolean(
          selectedDeviceId || selectedBackgroundItemId || selectedConnectionId,
        )}
        saving={saving}
        publishing={publishing}
        error={error}
        message={message}
        selectedConnection={selectedConnection}
        selectedBackgroundItem={selectedBackgroundItem}
        selectedDevice={selectedDevice}
        selectedPlacement={selectedPlacement}
        backgroundItems={layout.backgroundItems}
        devicesById={devicesById}
        onPatchBackgroundItem={handlePatchBackgroundItem}
        onRemoveBackgroundItem={handleRemoveBackgroundItem}
        onPatchPlacement={handlePatchPlacement}
        onRemoveDevice={() =>
          selectedDeviceId ? handleRemoveDevice(selectedDeviceId) : undefined
        }
        onDeleteSelected={handleDeleteSelected}
        onToggleSnap={() => setSnapToGrid((current) => !current)}
        onCopy={handleCopySelection}
        onPaste={handlePasteClipboard}
        onToggleLinkMode={toggleLinkMode}
        onCancelFlow={cancelFlow}
        onZoomIn={() => setZoom((current) => Math.min(2.5, current + 0.1))}
        onZoomOut={() => setZoom((current) => Math.max(0.5, current - 0.1))}
        onFit={() => {
          setZoom(1);
          setPanResetKey((current) => current + 1);
        }}
        onRotate={handleRotateSelected}
        onDelete={handleDeleteSelected}
        onReload={() => {
          void handleReload();
        }}
        onClear={handleClear}
        onPublish={() => {
          void handlePublish();
        }}
        onSave={() => {
          void handleSave();
        }}
      />

      <div className="flex flex-col gap-6">
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

        <DevicePalette
          placements={layout.placements}
          onAddPreset={(presetKey) => {
            const count = layout.placements.filter(
              (placement) => placement.presetKey === presetKey,
            ).length;
            handleAddPreset(presetKey, 120 + count * 40, 120 + count * 40);
          }}
        />
        <BackgroundPalette />
      </div>
    </div>
  );
}
