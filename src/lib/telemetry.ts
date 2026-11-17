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
