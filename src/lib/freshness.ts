export const DEVICE_STATUS_FRESH_MS = 60_000;
export const COMMAND_STATUS_FRESH_MS = 10 * 60 * 1000;
export const TELEMETRY_STALE_MS = DEVICE_STATUS_FRESH_MS;
export const STALE_CHECK_INTERVAL_MS = 10_000;
export const DEFAULT_CACHE_TTL_SECONDS = 24 * 60 * 60;

export function millisecondsToSeconds(value: number): number {
  return Math.ceil(value / 1000);
}
