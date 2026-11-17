"use client";

import {
  DEVICE_TYPE_LABELS,
  FARM_CANVAS_HEIGHT,
  FARM_CANVAS_WIDTH,
  type FarmLayoutDevice,
  type FarmLayoutPlacement,
} from "@/lib/farm-layout";

export type PlacementPatch = Partial<Omit<FarmLayoutPlacement, "deviceId">>;

export default function LayoutInspector({
  device,
  placement,
  onChange,
  onRemove,
}: {
  device: FarmLayoutDevice | null;
  placement: FarmLayoutPlacement | null;
  onChange: (patch: PlacementPatch) => void;
  onRemove: () => void;
}) {
  if (!device || !placement) {
    return (
      <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Inspector
        </h2>
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-4 text-center text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400">
          Select a device on the canvas to edit its label and rotation.
        </p>
      </aside>
    );
  }

  return (
    <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">
        Inspector
      </h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {device.name}
      </p>
      <p className="mt-2 inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
        {DEVICE_TYPE_LABELS[device.type] ?? device.type}
      </p>

      <div className="mt-5 space-y-4">
        <div>
          <label
            htmlFor="layout-device-label"
            className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-200"
          >
            Canvas label
          </label>
          <input
            id="layout-device-label"
            value={placement.label ?? ""}
            onChange={(event) =>
              onChange({ label: event.target.value.trim() ? event.target.value : null })
            }
            placeholder={device.name}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="layout-device-x"
              className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              X
            </label>
            <input
              id="layout-device-x"
              type="number"
              min={0}
              max={FARM_CANVAS_WIDTH}
              value={placement.x}
              onChange={(event) =>
                onChange({ x: Number(event.target.value) })
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
          <div>
            <label
              htmlFor="layout-device-y"
              className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              Y
            </label>
            <input
              id="layout-device-y"
              type="number"
              min={0}
              max={FARM_CANVAS_HEIGHT}
              value={placement.y}
              onChange={(event) =>
                onChange({ y: Number(event.target.value) })
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="layout-device-rotation"
            className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-200"
          >
            Rotation
          </label>
          <input
            id="layout-device-rotation"
            type="number"
            min={0}
            max={359}
            value={placement.rotation}
            onChange={(event) =>
              onChange({ rotation: Number(event.target.value) })
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
        >
          Remove from layout
        </button>
      </div>
    </aside>
  );
}
