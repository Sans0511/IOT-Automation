import type { DeviceRuntimeState } from "@/lib/telemetry";

export const RUNTIME_BADGE_CLASS: Record<DeviceRuntimeState, string> = {
  RUNNING: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  OPEN: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  RAINING: "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300",
  OFFLINE: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
  STALE: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300",
  STOPPED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  CLOSED: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  ONLINE: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  "NO DATA": "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};
