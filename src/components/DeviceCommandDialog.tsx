"use client";

import { useEffect } from "react";
import type { PendingDeviceCommand } from "@/lib/device-control";

export function DeviceCommandDialog({
  pending,
  busy,
  error,
  onCancel,
  onConfirm,
}: {
  pending: PendingDeviceCommand | null;
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    if (!pending) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) {
        onCancel();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [pending, busy, onCancel]);

  if (!pending) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4"
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="device-command-title"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
      >
        <h3
          id="device-command-title"
          className="text-lg font-semibold text-slate-900 dark:text-white"
        >
          Confirm manual control
        </h3>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
          Turn <strong>{pending.device.name}</strong>{" "}
          <strong>{pending.command}</strong>?
        </p>
        <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
          This publishes a command to the device MQTT topic.
        </p>

        {error ? (
          <p
            role="alert"
            className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300"
          >
            {error}
          </p>
        ) : null}

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
              pending.command === "ON"
                ? "bg-emerald-600 hover:bg-emerald-700"
                : "bg-slate-800 hover:bg-slate-900 dark:bg-slate-700 dark:hover:bg-slate-600"
            }`}
          >
            {busy ? "Sending..." : `Turn ${pending.command}`}
          </button>
        </div>
      </div>
    </div>
  );
}
