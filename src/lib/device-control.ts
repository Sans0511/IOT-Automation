import type { DeviceRuntimeStatus } from "./telemetry";

export type DeviceCommand = "ON" | "OFF";

export interface DeviceCommandTarget {
  id: string;
  name: string;
  type: string;
}

export interface PendingDeviceCommand {
  device: DeviceCommandTarget;
  command: DeviceCommand;
}

const CONTROLLABLE_DEVICE_TYPES = new Set([
  "MOTOR_PUMP",
  "PUMP",
  "SOLENOID_VALVE",
  "VALVE",
]);

export function isControllableDeviceType(type: string): boolean {
  return CONTROLLABLE_DEVICE_TYPES.has(type);
}

export function getToggleDeviceCommand(
  status: DeviceRuntimeStatus,
): DeviceCommand {
  return status.active ? "OFF" : "ON";
}
