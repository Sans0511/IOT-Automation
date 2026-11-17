"use client";

import { useState } from "react";
import {
  DEVICE_PRESET_DRAG_TYPE,
  DEVICE_TYPE_LABELS,
  FARM_DEVICE_PRESETS,
  type FarmDevicePresetKey,
  type FarmLayoutDevice,
  type FarmLayoutPlacement,
} from "@/lib/farm-layout";

const PALETTE_COLORS: Record<string, string> = {
  VALVE: "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  MOISTURE_SENSOR:
    "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  PUMP: "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  WEATHER_STATION:
    "bg-teal-100 text-teal-700 dark:bg-teal-950/40 dark:text-teal-300",
  WATER_TANK:
    "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  MOTOR_PUMP:
    "bg-violet-100 text-violet-700 dark:bg-violet-950/40 dark:text-violet-300",
  SOLENOID_VALVE:
    "bg-orange-100 text-orange-700 dark:bg-orange-950/40 dark:text-orange-300",
  SPRINKLER_LINE:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300",
  SMART_IRRIGATION_CONTROLLER:
    "bg-indigo-100 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-300",
  DELIVERY_POINT:
    "bg-lime-100 text-lime-700 dark:bg-lime-950/40 dark:text-lime-300",
};

const PRESET_KEYS = new Set<string>(
  FARM_DEVICE_PRESETS.map((preset) => preset.key),
);

export default function DevicePalette({
  devices,
  placements,
  onSelect,
  onRemove,
  onAddPreset,
}: {
  devices: FarmLayoutDevice[];
  placements: FarmLayoutPlacement[];
  onSelect: (deviceId: string) => void;
  onRemove: (deviceId: string) => void;
  onAddPreset: (presetKey: FarmDevicePresetKey) => void;
}) {
  const [search, setSearch] = useState("");
  const placedIds = new Set(placements.map((placement) => placement.deviceId));
  const presetCounts = placements.reduce<Record<string, number>>(
    (counts, placement) => {
      if (placement.presetKey) {
        counts[placement.presetKey] = (counts[placement.presetKey] ?? 0) + 1;
      }
      return counts;
    },
    {},
  );
  const visibleDevices = devices.filter(
    (device) =>
      !PRESET_KEYS.has(device.type) &&
      device.name.toLowerCase().includes(search.trim().toLowerCase()),
  );

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">
        Devices
      </h2>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        Drag an item onto the farm canvas.
      </p>

      <input
        value={search}
        onChange={(event) => setSearch(event.target.value)}
        placeholder="Search devices"
        className="mt-4 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
      />

      <div className="mt-5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Irrigation presets
        </p>
        <div className="space-y-2">
          {FARM_DEVICE_PRESETS.map((preset) => (
            <button
              key={preset.key}
              type="button"
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData(DEVICE_PRESET_DRAG_TYPE, preset.key);
                event.dataTransfer.effectAllowed = "copy";
              }}
              onClick={() => onAddPreset(preset.key)}
              title="Drag onto the canvas, or click to add in the center"
              className="flex w-full cursor-grab items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-emerald-300 hover:bg-emerald-50/50 active:cursor-grabbing dark:border-slate-700 dark:bg-slate-950 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/20"
            >
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${PALETTE_COLORS[preset.key]}`}
              >
                {preset.name}
              </span>
              {presetCounts[preset.key] ? (
                <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                  {presetCounts[preset.key]} placed
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-5">
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
          Farm devices
        </p>
        <div className="space-y-2">
          {visibleDevices.length ? (
            visibleDevices.map((device) => {
              const placed = placedIds.has(device.id);

              return (
                <div
                  key={device.id}
                  draggable
                  onDragStart={(event) => {
                    event.dataTransfer.setData(
                      "application/x-farm-device-id",
                      device.id,
                    );
                    event.dataTransfer.effectAllowed = "copy";
                  }}
                  className="cursor-grab rounded-xl border border-slate-200 bg-white p-3 transition hover:border-emerald-300 hover:bg-emerald-50/50 active:cursor-grabbing dark:border-slate-700 dark:bg-slate-950 dark:hover:border-emerald-700 dark:hover:bg-emerald-950/20"
                >
                  <div className="flex items-start justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => onSelect(device.id)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-sm font-medium text-slate-900 dark:text-white">
                        {device.name}
                      </span>
                      <span
                        className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          PALETTE_COLORS[device.type] ??
                          "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {DEVICE_TYPE_LABELS[device.type] ?? device.type}
                      </span>
                    </button>
                    {placed ? (
                      <button
                        type="button"
                        onClick={() => onRemove(device.id)}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 dark:text-red-300 dark:hover:bg-red-950/40"
                      >
                        Remove
                      </button>
                    ) : null}
                  </div>
                  {placed ? (
                    <p className="mt-2 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      Placed on canvas
                    </p>
                  ) : null}
                </div>
              );
            })
          ) : (
            <p className="rounded-lg bg-slate-50 px-3 py-4 text-center text-xs text-slate-500 dark:bg-slate-950 dark:text-slate-400">
              No devices match your search.
            </p>
          )}
        </div>
      </div>
    </aside>
  );
}
