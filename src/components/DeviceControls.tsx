"use client";

import { DEVICE_TYPE_LABELS } from "@/lib/farm-layout";
import {
  isControllableDeviceType,
  type DeviceCommand,
  type DeviceCommandTarget,
} from "@/lib/device-control";
import { RUNTIME_BADGE_CLASS } from "@/lib/runtime-status-ui";
import {
  getDeviceRuntimeStatus,
  type DeviceMessageEnvelope,
} from "@/lib/telemetry";

export function DeviceControls({
  devices,
  statuses,
  notice,
  busy,
  onRequest,
}: {
  devices: DeviceCommandTarget[];
  statuses: Record<string, DeviceMessageEnvelope>;
  notice: string | null;
  busy: boolean;
  onRequest: (device: DeviceCommandTarget, command: DeviceCommand) => void;
}) {
  const controllableDevices = devices.filter((device) =>
    isControllableDeviceType(device.type),
  );

  if (controllableDevices.length === 0) {
    return null;
  }

  return (
    <section
      id="manual-controls"
      className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Manual controls
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Switch pumps and valves on or off, or double-click a device on the
            layout to toggle it.
          </p>
        </div>
      </div>

      {notice ? (
        <p
          role="status"
          className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
        >
          {notice}
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {controllableDevices.map((device) => {
          const runtime = getDeviceRuntimeStatus(statuses[device.id], device.type);

          return (
            <div
              key={device.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900 dark:text-white">
                  {device.name}
                </p>
                <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                  {DEVICE_TYPE_LABELS[device.type] ?? device.type}
                </p>
                <span
                  className={`mt-2 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${RUNTIME_BADGE_CLASS[runtime.state]}`}
                >
                  {runtime.state}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  aria-label={`Turn ${device.name} ON`}
                  disabled={busy}
                  onClick={() => onRequest(device, "ON")}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  ON
                </button>
                <button
                  type="button"
                  aria-label={`Turn ${device.name} OFF`}
                  disabled={busy}
                  onClick={() => onRequest(device, "OFF")}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  OFF
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
