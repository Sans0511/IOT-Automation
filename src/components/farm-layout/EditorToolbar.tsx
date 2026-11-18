"use client";

import {
  DEVICE_TYPE_LABELS,
  FARM_BACKGROUND_LABELS,
  FARM_CANVAS_HEIGHT,
  FARM_CANVAS_WIDTH,
  type BackgroundItemPatch,
  type FarmLayoutBackgroundItem,
  type FarmLayoutConnection,
  type FarmLayoutDevice,
  type FarmLayoutPlacement,
  type PlacementPatch,
} from "@/lib/farm-layout";
import { connectionLabel, endpointPortLabel } from "./flow-utils";

type EditorToolbarProps = {
  isDirty: boolean;
  placementCount: number;
  backgroundItemCount: number;
  connectionCount: number;
  snapToGrid: boolean;
  canCopy: boolean;
  canPaste: boolean;
  linkMode: boolean;
  hasLinkSource: boolean;
  canRotate: boolean;
  canDelete: boolean;
  saving: boolean;
  publishing: boolean;
  error: string | null;
  message: string | null;
  selectedConnection: FarmLayoutConnection | null;
  selectedBackgroundItem: FarmLayoutBackgroundItem | null;
  selectedDevice: FarmLayoutDevice | null;
  selectedPlacement: FarmLayoutPlacement | null;
  backgroundItems: FarmLayoutBackgroundItem[];
  devicesById: Map<string, FarmLayoutDevice>;
  onPatchBackgroundItem: (patch: BackgroundItemPatch) => void;
  onRemoveBackgroundItem: () => void;
  onPatchPlacement: (patch: PlacementPatch) => void;
  onRemoveDevice: () => void;
  onDeleteSelected: () => void;
  onToggleSnap: () => void;
  onCopy: () => void;
  onPaste: () => void;
  onToggleLinkMode: () => void;
  onCancelFlow: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onRotate: (delta: number) => void;
  onDelete: () => void;
  onReload: () => void;
  onClear: () => void;
  onPublish: () => void;
  onSave: () => void;
};

const FIELD_CLASS =
  "w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white";
const REMOVE_CLASS =
  "rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40";

export default function EditorToolbar({
  isDirty,
  placementCount,
  backgroundItemCount,
  connectionCount,
  snapToGrid,
  canCopy,
  canPaste,
  linkMode,
  hasLinkSource,
  canRotate,
  canDelete,
  saving,
  publishing,
  error,
  message,
  selectedConnection,
  selectedBackgroundItem,
  selectedDevice,
  selectedPlacement,
  backgroundItems,
  devicesById,
  onPatchBackgroundItem,
  onRemoveBackgroundItem,
  onPatchPlacement,
  onRemoveDevice,
  onDeleteSelected,
  onToggleSnap,
  onCopy,
  onPaste,
  onToggleLinkMode,
  onCancelFlow,
  onZoomIn,
  onZoomOut,
  onFit,
  onRotate,
  onDelete,
  onReload,
  onClear,
  onPublish,
  onSave,
}: EditorToolbarProps) {
  function renderInspector() {
    if (selectedConnection) {
      return (
        <>
          <div className="min-w-[240px] flex-1">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
              {connectionLabel(
                selectedConnection,
                "from",
                devicesById,
                backgroundItems,
              )}
              <span className="mx-2 text-sky-600 dark:text-sky-400">→</span>
              {connectionLabel(
                selectedConnection,
                "to",
                devicesById,
                backgroundItems,
              )}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {endpointPortLabel(selectedConnection, "from")}
              <span className="mx-2">→</span>
              {endpointPortLabel(selectedConnection, "to")}
            </p>
          </div>
          <button type="button" onClick={onDeleteSelected} className={REMOVE_CLASS}>
            Remove link
          </button>
        </>
      );
    }

    if (selectedBackgroundItem) {
      return (
        <>
          <div className="min-w-[280px] flex-1">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
              {FARM_BACKGROUND_LABELS[selectedBackgroundItem.type]}
            </p>
          </div>
          <label className="w-20">
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-400">
              X
            </span>
            <input
              type="number"
              min={0}
              max={FARM_CANVAS_WIDTH}
              value={selectedBackgroundItem.x}
              onChange={(event) =>
                onPatchBackgroundItem({ x: Number(event.target.value) })
              }
              className={FIELD_CLASS}
            />
          </label>
          <label className="w-20">
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-400">
              Y
            </span>
            <input
              type="number"
              min={0}
              max={FARM_CANVAS_HEIGHT}
              value={selectedBackgroundItem.y}
              onChange={(event) =>
                onPatchBackgroundItem({ y: Number(event.target.value) })
              }
              className={FIELD_CLASS}
            />
          </label>
          <label className="w-20">
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-400">
              Rotation
            </span>
            <input
              type="number"
              min={0}
              max={359}
              value={selectedBackgroundItem.rotation}
              onChange={(event) =>
                onPatchBackgroundItem({ rotation: Number(event.target.value) })
              }
              className={FIELD_CLASS}
            />
          </label>
          <label className="w-28">
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-400">
              Size
            </span>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.1}
              value={selectedBackgroundItem.scale}
              onChange={(event) =>
                onPatchBackgroundItem({ scale: Number(event.target.value) })
              }
              className="w-full accent-emerald-600"
            />
          </label>
          <button type="button" onClick={onRemoveBackgroundItem} className={REMOVE_CLASS}>
            Remove item
          </button>
        </>
      );
    }

    if (selectedDevice && selectedPlacement) {
      return (
        <>
          <div className="min-w-[180px] flex-1">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
              {selectedDevice.name}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              {DEVICE_TYPE_LABELS[selectedDevice.type] ?? selectedDevice.type}
            </p>
          </div>
          <label className="w-44">
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-400">
              Canvas label
            </span>
            <input
              value={selectedPlacement.label ?? ""}
              onChange={(event) =>
                onPatchPlacement({
                  label: event.target.value.trim() ? event.target.value : null,
                })
              }
              placeholder={selectedDevice.name}
              className={FIELD_CLASS}
            />
          </label>
          <label className="w-20">
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-400">
              X
            </span>
            <input
              type="number"
              min={0}
              max={FARM_CANVAS_WIDTH}
              value={selectedPlacement.x}
              onChange={(event) =>
                onPatchPlacement({ x: Number(event.target.value) })
              }
              className={FIELD_CLASS}
            />
          </label>
          <label className="w-20">
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-400">
              Y
            </span>
            <input
              type="number"
              min={0}
              max={FARM_CANVAS_HEIGHT}
              value={selectedPlacement.y}
              onChange={(event) =>
                onPatchPlacement({ y: Number(event.target.value) })
              }
              className={FIELD_CLASS}
            />
          </label>
          <label className="w-20">
            <span className="mb-1 block text-[10px] font-medium uppercase tracking-wide text-slate-400">
              Rotation
            </span>
            <input
              type="number"
              min={0}
              max={359}
              value={selectedPlacement.rotation}
              onChange={(event) =>
                onPatchPlacement({ rotation: Number(event.target.value) })
              }
              className={FIELD_CLASS}
            />
          </label>
          <button type="button" onClick={onRemoveDevice} className={REMOVE_CLASS}>
            Remove device
          </button>
        </>
      );
    }

    return (
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Select a device, background item, or flow line on the canvas to edit it.
      </p>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-950/40">
        <div className="min-w-[90px]">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Inspector
          </p>
        </div>
        {renderInspector()}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
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
            {placementCount} device
            {placementCount === 1 ? "" : "s"} ·{" "}
            {backgroundItemCount} background item
            {backgroundItemCount === 1 ? "" : "s"} ·{" "}
            {connectionCount} link
            {connectionCount === 1 ? "" : "s"}
          </span>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onToggleSnap}
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
            onClick={onCopy}
            disabled={!canCopy}
            title="Copy selected device or background item (Ctrl/Cmd+C)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Copy
          </button>
          <button
            type="button"
            onClick={onPaste}
            disabled={!canPaste}
            title="Paste copied item (Ctrl/Cmd+V)"
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Paste
          </button>
          <button
            type="button"
            onClick={onToggleLinkMode}
            className={`rounded-lg border px-3 py-2 text-xs font-medium transition ${
              linkMode
                ? "border-sky-300 bg-sky-50 text-sky-700 dark:border-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300"
            }`}
          >
            {linkMode ? "Drawing flow" : "Draw flow"}
          </button>
          {linkMode && hasLinkSource ? (
            <button
              type="button"
              onClick={onCancelFlow}
              className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
            >
              Cancel flow
            </button>
          ) : null}
          <button
            type="button"
            onClick={onZoomIn}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Zoom in
          </button>
          <button
            type="button"
            onClick={onZoomOut}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Zoom out
          </button>
          <button
            type="button"
            onClick={onFit}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Fit
          </button>
          <button
            type="button"
            onClick={() => onRotate(-15)}
            disabled={!canRotate}
            title="Rotate selected item 15 degrees counter-clockwise"
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Rotate -15°
          </button>
          <button
            type="button"
            onClick={() => onRotate(15)}
            disabled={!canRotate}
            title="Rotate selected item 15 degrees clockwise"
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Rotate +15°
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={!canDelete}
            title="Delete selected item"
            className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            Delete selected
          </button>
          <button
            type="button"
            onClick={onReload}
            className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Reload
          </button>
          <button
            type="button"
            onClick={onClear}
            className="rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={onPublish}
            disabled={saving || publishing}
            className="rounded-lg border border-emerald-300 px-4 py-2 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-emerald-700 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
          >
            {publishing ? "Publishing..." : "Publish"}
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving || !isDirty}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save layout"}
          </button>
        </div>
      </div>

      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        Drag irrigation presets or scenery onto the canvas. Select an item to
        edit it in the inspector above. With Draw flow on, start and end lines
        at ports, or branch from an existing flow line.
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
  );
}
