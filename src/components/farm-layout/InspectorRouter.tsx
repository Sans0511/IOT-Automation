"use client";

import BackgroundInspector, {
  type BackgroundItemPatch,
} from "./BackgroundInspector";
import { connectionLabel, endpointPortLabel } from "./flow-utils";
import LayoutInspector, { type PlacementPatch } from "./LayoutInspector";
import type {
  FarmLayoutBackgroundItem,
  FarmLayoutConnection,
  FarmLayoutDevice,
  FarmLayoutPlacement,
} from "@/lib/farm-layout";

export default function InspectorRouter({
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
}: {
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
}) {
  if (selectedConnection) {
    return (
      <aside className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Connection
        </h2>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
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
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {endpointPortLabel(selectedConnection, "from")}
          <span className="mx-2">→</span>
          {endpointPortLabel(selectedConnection, "to")}
        </p>
        <button
          type="button"
          onClick={onDeleteSelected}
          className="mt-5 w-full rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
        >
          Remove link
        </button>
      </aside>
    );
  }

  if (selectedBackgroundItem) {
    return (
      <BackgroundInspector
        item={selectedBackgroundItem}
        onChange={onPatchBackgroundItem}
        onRemove={onRemoveBackgroundItem}
      />
    );
  }

  return (
    <LayoutInspector
      device={selectedDevice}
      placement={selectedPlacement}
      onChange={onPatchPlacement}
      onRemove={onRemoveDevice}
    />
  );
}
