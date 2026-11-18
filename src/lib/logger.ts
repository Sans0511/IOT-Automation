type LogLevel = "info" | "warn" | "error";

type LogFields = Record<string, unknown>;

const RESERVED_FIELDS = new Set(["timestamp", "level", "event"]);

function isScalar(value: unknown): value is string | number | boolean | null {
  if (value === null) {
    return true;
  }

  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  return typeof value === "string" || typeof value === "boolean";
}

function emit(level: LogLevel, event: string, fields: LogFields): void {
  const entry: Record<string, string | number | boolean | null> = {};

  for (const [key, value] of Object.entries(fields)) {
    if (RESERVED_FIELDS.has(key) || !isScalar(value) || value === undefined) {
      continue;
    }

    entry[key] = value;
  }

  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...entry,
  });

  if (level === "error") {
    console.error(line);
  } else if (level === "warn") {
    console.warn(line);
  } else {
    console.log(line);
  }
}

export function logInfo(event: string, fields: LogFields = {}): void {
  emit("info", event, fields);
}

export function logWarn(event: string, fields: LogFields = {}): void {
  emit("warn", event, fields);
}

export function logError(event: string, fields: LogFields = {}): void {
  emit("error", event, fields);
}
