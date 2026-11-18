import test from "node:test";
import assert from "node:assert/strict";
import { DEVICE_STATUS_FRESH_MS } from "./freshness";
import {
  getDeviceRuntimeStatus,
  type DeviceMessageEnvelope,
} from "./telemetry";

const NOW = Date.parse("2026-01-01T00:00:00.000Z");

function makeEnvelope(
  payload: Record<string, unknown>,
  overrides: Partial<DeviceMessageEnvelope> = {},
): DeviceMessageEnvelope {
  return {
    farmId: "farm-1",
    deviceId: "device-1",
    kind: "status",
    payload,
    topic: "farm/1/device/1/status",
    receivedAt: new Date(NOW).toISOString(),
    ...overrides,
  };
}

test("RAIN_DETECTION reports RAINING for rain payloads", () => {
  const fromBoolean = getDeviceRuntimeStatus(
    makeEnvelope({ raining: true }),
    "RAIN_DETECTION",
    NOW,
  );
  assert.deepStrictEqual(fromBoolean, {
    state: "RAINING",
    active: true,
    stale: false,
    online: true,
  });

  const fromState = getDeviceRuntimeStatus(
    makeEnvelope({ state: "RAINING" }),
    "RAIN_DETECTION",
    NOW,
  );
  assert.deepStrictEqual(fromState, {
    state: "RAINING",
    active: true,
    stale: false,
    online: true,
  });
});

test("an explicit STALE state reports STALE", () => {
  const status = getDeviceRuntimeStatus(
    makeEnvelope({ state: "STALE" }),
    "MOTOR_PUMP",
    NOW,
  );
  assert.deepStrictEqual(status, {
    state: "STALE",
    active: false,
    stale: true,
    online: false,
  });

  const rainStatus = getDeviceRuntimeStatus(
    makeEnvelope({ state: "STALE" }),
    "RAIN_DETECTION",
    NOW,
  );
  assert.strictEqual(rainStatus.state, "STALE");
  assert.strictEqual(rainStatus.stale, true);
});

test("an envelope older than DEVICE_STATUS_FRESH_MS reports STALE", () => {
  const oldEnvelope = makeEnvelope(
    { state: "RUNNING" },
    {
      receivedAt: new Date(NOW - DEVICE_STATUS_FRESH_MS - 1).toISOString(),
    },
  );
  const staleStatus = getDeviceRuntimeStatus(oldEnvelope, "MOTOR_PUMP", NOW);
  assert.deepStrictEqual(staleStatus, {
    state: "STALE",
    active: false,
    stale: true,
    online: false,
  });

  const freshEnvelope = makeEnvelope(
    { state: "RUNNING" },
    { receivedAt: new Date(NOW - DEVICE_STATUS_FRESH_MS).toISOString() },
  );
  assert.strictEqual(
    getDeviceRuntimeStatus(freshEnvelope, "MOTOR_PUMP", NOW).state,
    "RUNNING",
  );
});

test("OFFLINE payloads report OFFLINE and take precedence over rain", () => {
  const offlineStatus = getDeviceRuntimeStatus(
    makeEnvelope({ state: "OFFLINE" }),
    "MOTOR_PUMP",
    NOW,
  );
  assert.deepStrictEqual(offlineStatus, {
    state: "OFFLINE",
    active: false,
    stale: false,
    online: false,
  });

  const disconnectedStatus = getDeviceRuntimeStatus(
    makeEnvelope({ online: false, state: "RUNNING" }),
    "MOTOR_PUMP",
    NOW,
  );
  assert.strictEqual(disconnectedStatus.state, "OFFLINE");

  const rainStatus = getDeviceRuntimeStatus(
    makeEnvelope({ state: "OFFLINE", raining: true }),
    "RAIN_DETECTION",
    NOW,
  );
  assert.strictEqual(rainStatus.state, "OFFLINE");
  assert.strictEqual(rainStatus.active, false);
  assert.strictEqual(rainStatus.online, false);
});
