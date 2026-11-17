"use client";

import {
  FARM_BACKGROUND_LABELS,
  type FarmLayoutBackgroundItem,
} from "@/lib/farm-layout";

export type BackgroundItemPatch = Partial<
  Omit<FarmLayoutBackgroundItem, "id" | "type">
>;

export default function BackgroundInspector({
  item,
  onChange,
  onRemove,
}: {
  item: FarmLayoutBackgroundItem | null;
  onChange: (patch: BackgroundItemPatch) => void;
  onRemove: () => void;
}) {
  if (!item) {
    return null;
  }

  return (
    <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">
        Background item
      </h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {FARM_BACKGROUND_LABELS[item.type]}
      </p>

      <div className="mt-5 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="background-item-x"
              className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              X
            </label>
            <input
              id="background-item-x"
              type="number"
              min={0}
              max={1200}
              value={item.x}
              onChange={(event) =>
                onChange({ x: Number(event.target.value) })
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
          <div>
            <label
              htmlFor="background-item-y"
              className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-200"
            >
              Y
            </label>
            <input
              id="background-item-y"
              type="number"
              min={0}
              max={800}
              value={item.y}
              onChange={(event) =>
                onChange({ y: Number(event.target.value) })
              }
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="background-item-rotation"
            className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-200"
          >
            Rotation
          </label>
          <input
            id="background-item-rotation"
            type="number"
            min={0}
            max={359}
            value={item.rotation}
            onChange={(event) =>
              onChange({ rotation: Number(event.target.value) })
            }
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
          />
        </div>

        <div>
          <label
            htmlFor="background-item-scale"
            className="mb-1.5 block text-xs font-medium text-slate-700 dark:text-slate-200"
          >
            Size
          </label>
          <input
            id="background-item-scale"
            type="range"
            min={0.5}
            max={2}
            step={0.1}
            value={item.scale}
            onChange={(event) =>
              onChange({ scale: Number(event.target.value) })
            }
            className="w-full accent-emerald-600"
          />
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
        >
          Remove item
        </button>
      </div>
    </aside>
  );
}
