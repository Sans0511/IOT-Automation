"use client";

import {
  BACKGROUND_ITEM_DRAG_TYPE,
  FARM_BACKGROUND_ITEM_TYPES,
  FARM_BACKGROUND_LABELS,
  type FarmBackgroundItemType,
} from "@/lib/farm-layout";

const ITEM_STYLES: Record<FarmBackgroundItemType, string> = {
  TREE: "bg-green-100 text-green-700 dark:bg-green-950/40 dark:text-green-300",
  WATER_TANK:
    "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  POND: "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300",
  SHED: "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  FLOWER_BED:
    "bg-pink-100 text-pink-700 dark:bg-pink-950/40 dark:text-pink-300",
};

export default function BackgroundPalette() {
  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">
        Background items
      </h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Drag scenery onto the farm canvas.
      </p>

      <div className="mt-4 space-y-2">
        {FARM_BACKGROUND_ITEM_TYPES.map((type) => (
          <div
            key={type}
            draggable
            onDragStart={(event) => {
              event.dataTransfer.setData(BACKGROUND_ITEM_DRAG_TYPE, type);
              event.dataTransfer.effectAllowed = "copy";
            }}
            className="flex cursor-grab items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-emerald-300 hover:bg-emerald-50/50 active:cursor-grabbing dark:border-slate-700 dark:bg-slate-950 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/20"
          >
            <span
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${ITEM_STYLES[type]}`}
            >
              {FARM_BACKGROUND_LABELS[type].slice(0, 1)}
            </span>
            <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
              {FARM_BACKGROUND_LABELS[type]}
            </span>
          </div>
        ))}
      </div>
    </aside>
  );
}
