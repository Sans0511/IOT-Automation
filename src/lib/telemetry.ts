import {
  COMMAND_STATUS_FRESH_MS,
  DEVICE_STATUS_FRESH_MS,
  TELEMETRY_STALE_MS,
} from "./freshness";

export { COMMAND_STATUS_FRESH_MS, DEVICE_STATUS_FRESH_MS, TELEMETRY_STALE_MS };

export type DeviceMessageKind = "status" | "telemetry";

export interface DeviceMessageEnvelope {
  farmId: string;
  deviceId: string;
  kind: DeviceMessageKind;
  payload: Record<string, unknown>;
  topic: string;
  receivedAt: string;
}

export function deviceMessageKey(
  farmId: string,
  deviceId: string,
  kind: DeviceMessageKind,
): string {
  return `device:${farmId}:${deviceId}:${kind}`;
}

export function telemetryChannel(farmId: string, deviceId: string): string {
  return `telemetry:${farmId}:${deviceId}`;
}

export function statusChannel(farmId: string, deviceId: string): string {
  return `status:${farmId}:${deviceId}`;
}

export function deviceChannel(envelope: DeviceMessageEnvelope): string {
  return envelope.kind === "status"
    ? statusChannel(envelope.farmId, envelope.deviceId)
    : telemetryChannel(envelope.farmId, envelope.deviceId);
}

export type DeviceRuntimeState =
  | "RUNNING"
  | "RAINING"
  | "STOPPED"
  | "OPEN"
  | "CLOSED"
  | "ONLINE"
  | "OFFLINE"
  | "STALE"
  | "NO DATA";

export interface DeviceRuntimeStatus {
  state: DeviceRuntimeState;
  active: boolean;
  stale: boolean;
  online: boolean;
}

function readBoolean(
  payload: Record<string, unknown>,
  keys: string[],
): boolean | null {
  for (const key of keys) {
    if (typeof payload[key] === "boolean") {
      return payload[key];
    }
  }

  return null;
}

function readState(payload: Record<string, unknown>): string {
  for (const key of ["state", "status"]) {
    const value = payload[key];

    if (typeof value === "string") {
      return value.trim().toUpperCase();
    }
  }

  return "";
}

function stateActiveValue(state: string): boolean | null {
  if (["RUNNING", "ON", "OPEN", "ACTIVE"].includes(state)) {
    return true;
  }

  if (["STOPPED", "OFF", "CLOSED", "INACTIVE"].includes(state)) {
    return false;
  }

  return null;
}

export function isSensorDeviceType(deviceType: string): boolean {
  return (
    deviceType === "SENSOR" ||
    deviceType === "MOISTURE_SENSOR" ||
    deviceType.endsWith("_SENSOR")
  );
}

export function isRainDeviceType(deviceType: string): boolean {
  return deviceType === "RAIN_DETECTION" || deviceType === "RAIN_SENSOR";
}

export function getDeviceRuntimeStatus(
  envelope: DeviceMessageEnvelope | null | undefined,
  deviceType: string,
  now = Date.now(),
): DeviceRuntimeStatus {
  if (!envelope) {
    return { state: "NO DATA", active: false, stale: false, online: false };
  }

  const receivedAt = Date.parse(envelope.receivedAt);
  const fromCommand = envelope.payload.source === "command";

  const freshnessWindow = fromCommand
    ? COMMAND_STATUS_FRESH_MS
    : DEVICE_STATUS_FRESH_MS;

  if (!Number.isNaN(receivedAt) && now - receivedAt > freshnessWindow) {
    return { state: "STALE", active: false, stale: true, online: false };
  }

  const state = readState(envelope.payload);
  const explicitOnline = readBoolean(envelope.payload, ["online", "connected"]);
  const explicitActiveKeys =
    deviceType === "SOLENOID_VALVE" || deviceType === "VALVE"
      ? ["valveOpen", "open", "active"]
      : ["pumpOn", "running", "active"];
  const explicitActive = readBoolean(envelope.payload, explicitActiveKeys);
  const derivedActive = stateActiveValue(state);
  const hasActiveValue = explicitActive !== null || derivedActive !== null;
  const active = explicitActive ?? derivedActive ?? false;
  const offline = state === "OFFLINE" || explicitOnline === false;
  const online =
    !offline &&
    (explicitOnline === true || state === "ONLINE" || hasActiveValue);

  if (offline) {
    return { state: "OFFLINE", active: false, stale: false, online: false };
  }

  if (isRainDeviceType(deviceType)) {
    const raining = readBoolean(envelope.payload, ["raining", "rain"]);

    if (state === "RAINING" || raining === true) {
      return { state: "RAINING", active: true, stale: false, online: true };
    }

    if (state === "STALE" || raining === false) {
      return { state: "STALE", active: false, stale: true, online: false };
    }
  }

  if (state === "STALE") {
    return { state: "STALE", active: false, stale: true, online: false };
  }

  if (
    isSensorDeviceType(deviceType) &&
    (envelope.kind === "telemetry" ||
      explicitOnline === true ||
      state === "ONLINE" ||
      state === "RUNNING" ||
      state === "ACTIVE")
  ) {
    return { state: "RUNNING", active: true, stale: false, online: true };
  }

  if (hasActiveValue && active) {
    return {
      state:
        deviceType === "SOLENOID_VALVE" || deviceType === "VALVE"
          ? "OPEN"
          : "RUNNING",
      active: true,
      stale: false,
      online: true,
    };
  }

  if (hasActiveValue) {
    return {
      state:
        deviceType === "SOLENOID_VALVE" || deviceType === "VALVE"
          ? "CLOSED"
          : "STOPPED",
      active: false,
      stale: false,
      online: true,
    };
  }

  if (online) {
    return { state: "ONLINE", active: false, stale: false, online: true };
  }

  return { state: "NO DATA", active: false, stale: false, online: false };
}

export function resolveDeviceRuntimeStatus(
  deviceType: string,
  status: DeviceMessageEnvelope | null | undefined,
  telemetry: DeviceMessageEnvelope | null | undefined,
): DeviceRuntimeStatus {
  let message = status;

  if (isSensorDeviceType(deviceType) && telemetry) {
    const statusRuntime = status
      ? getDeviceRuntimeStatus(status, deviceType)
      : null;

    if (statusRuntime?.state !== "OFFLINE") {
      message = telemetry;
    }
  }

  return getDeviceRuntimeStatus(message, deviceType);
}

const MOISTURE_PAYLOAD_KEYS = [
  "moisture",
  "soilMoisture",
  "soil_moisture",
  "moistureLevel",
  "moisture_level",
  "moisturePercent",
  "moisture_percent",
  "percentage",
  "value",
];

export function getMoisturePercent(
  envelope: DeviceMessageEnvelope | null | undefined,
  now = Date.now(),
): number | null {
  if (!envelope || envelope.kind !== "telemetry") {
    return null;
  }

  const receivedAt = Date.parse(envelope.receivedAt);

  if (!Number.isNaN(receivedAt) && now - receivedAt > TELEMETRY_STALE_MS) {
    return null;
  }

  for (const key of MOISTURE_PAYLOAD_KEYS) {
    const raw = envelope.payload[key];
    const value =
      typeof raw === "number"
        ? raw
        : typeof raw === "string" && raw.trim() !== ""
          ? Number(raw)
          : Number.NaN;

    if (Number.isFinite(value)) {
      return Math.min(100, Math.max(0, Math.round(value)));
    }
  }

  return null;
}

export function parseDeviceMessageEnvelope(
  value: string,
): DeviceMessageEnvelope | null {
  try {
    const parsed: unknown = JSON.parse(value);

    if (
      typeof parsed !== "object" ||
      parsed === null ||
      Array.isArray(parsed)
    ) {
      return null;
    }

    const envelope = parsed as Partial<DeviceMessageEnvelope>;

    if (
      typeof envelope.farmId !== "string" ||
      typeof envelope.deviceId !== "string" ||
      (envelope.kind !== "status" && envelope.kind !== "telemetry") ||
      typeof envelope.payload !== "object" ||
      envelope.payload === null ||
      Array.isArray(envelope.payload) ||
      typeof envelope.topic !== "string" ||
      typeof envelope.receivedAt !== "string"
    ) {
      return null;
    }

    return envelope as DeviceMessageEnvelope;
  } catch {
    return null;
  }
}
