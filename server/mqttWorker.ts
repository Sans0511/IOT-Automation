import "dotenv/config";

import { randomUUID } from "crypto";
import { connect, type MqttClient } from "mqtt";
import {
  DEFAULT_CACHE_TTL_SECONDS,
  STALE_CHECK_INTERVAL_MS,
  TELEMETRY_STALE_MS,
} from "../src/lib/freshness";
import { logError, logInfo, logWarn } from "../src/lib/logger";
import { getMqttBrokerUrl } from "../src/lib/mqttClient";
import { getRedis, publishDeviceStatus, publishTelemetry } from "../src/lib/redis";
import {
  deviceChannel,
  deviceMessageKey,
  type DeviceMessageEnvelope,
} from "../src/lib/telemetry";

const STATUS_TOPIC = "farm/+/device/+/status";
const TELEMETRY_TOPIC = "farm/+/device/+/telemetry";
const TOPIC_PATTERN = /^farm\/([^/]+)\/device\/([^/]+)\/(status|telemetry)$/;
const RECONNECT_DELAY_MS = 2_000;
const CONNECT_TIMEOUT_MS = 10_000;
const TELEMETRY_LAST_SEEN_PREFIX = "telemetry:last-seen:";
const TELEMETRY_LAST_SEEN_PATTERN = /^telemetry:last-seen:([^:]+):([^:]+)$/;
const TELEMETRY_LAST_SEEN_TTL_SECONDS = DEFAULT_CACHE_TTL_SECONDS;

type MessageKind = "status" | "telemetry";
type RedisClient = Awaited<ReturnType<typeof getRedis>>;

interface DeviceTopic {
  farmId: string;
  deviceId: string;
  kind: MessageKind;
}

let redisClient: RedisClient | null = null;
let queue: Promise<void> = Promise.resolve();
let staleScanQueued = false;

/** Reads the Redis TTL once at startup and rejects invalid configuration. */
function getCacheTtlSeconds(): number {
  const raw = process.env.MQTT_CACHE_TTL_SECONDS;

  if (!raw) {
    return DEFAULT_CACHE_TTL_SECONDS;
  }

  const ttl = Number(raw);

  if (!Number.isInteger(ttl) || ttl <= 0) {
    throw new Error("MQTT_CACHE_TTL_SECONDS must be a positive integer");
  }

  return ttl;
}

/** Extracts farm, device, and message kind from an inbound MQTT topic. */
export function parseDeviceTopic(topic: string): DeviceTopic | null {
  const match = TOPIC_PATTERN.exec(topic);

  if (!match) {
    return null;
  }

  const [, farmId, deviceId, kind] = match;

  return {
    farmId,
    deviceId,
    kind: kind as MessageKind,
  };
}

/** Accepts only JSON objects so dashboard consumers get a stable shape. */
function parseJsonObject(message: Buffer): Record<string, unknown> {
  const parsed: unknown = JSON.parse(message.toString("utf8"));

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    throw new Error("MQTT payload must be a JSON object");
  }

  return parsed as Record<string, unknown>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function getWorkerRedis(): Promise<RedisClient> {
  if (!redisClient) {
    redisClient = await getRedis();
  }

  return redisClient;
}

function telemetryLastSeenKey(farmId: string, deviceId: string): string {
  return `${TELEMETRY_LAST_SEEN_PREFIX}${farmId}:${deviceId}`;
}

function parseTelemetryLastSeenKey(
  key: string,
): { farmId: string; deviceId: string } | null {
  const match = TELEMETRY_LAST_SEEN_PATTERN.exec(key);

  if (!match) {
    return null;
  }

  const [, farmId, deviceId] = match;
  return { farmId, deviceId };
}

function isStaleTimestamp(lastSeen: string | null, now: number): boolean {
  if (lastSeen === null) {
    return false;
  }

  const timestamp = Number(lastSeen);
  return Number.isFinite(timestamp) && now - timestamp >= TELEMETRY_STALE_MS;
}

function createDeviceMessageEnvelope(
  deviceTopic: DeviceTopic,
  payload: Record<string, unknown>,
  topic: string,
): DeviceMessageEnvelope {
  return {
    farmId: deviceTopic.farmId,
    deviceId: deviceTopic.deviceId,
    kind: deviceTopic.kind,
    payload,
    topic,
    receivedAt: new Date().toISOString(),
  };
}

async function cacheStatusMessage(
  deviceTopic: DeviceTopic,
  envelope: DeviceMessageEnvelope,
  ttlSeconds: number,
): Promise<string> {
  const redis = await getWorkerRedis();
  const key = deviceMessageKey(
    deviceTopic.farmId,
    deviceTopic.deviceId,
    "status",
  );

  await redis.set(key, JSON.stringify(envelope), { EX: ttlSeconds });

  return key;
}

async function setSensorStatus(
  farmId: string,
  deviceId: string,
  state: "ONLINE" | "STALE",
  cacheTtlSeconds: number,
): Promise<void> {
  const deviceTopic: DeviceTopic = { farmId, deviceId, kind: "status" };
  const envelope = createDeviceMessageEnvelope(
    deviceTopic,
    { state },
    `farm/${farmId}/device/${deviceId}/status`,
  );
  const key = await cacheStatusMessage(deviceTopic, envelope, cacheTtlSeconds);

  logInfo("mqtt_cached_sensor_status", { state, key });
  await publishDeviceStatus(envelope);
}

/** Serializes Redis writes so a slower write cannot overwrite newer data. */
function enqueue(
  task: () => Promise<void>,
  event = "mqtt_message_handling_failed",
): void {
  queue = queue.then(task).catch((error: unknown) => {
    logError(event, { error: errorMessage(error) });
  });
}

function markStaleSensors(cacheTtlSeconds: number): void {
  if (staleScanQueued) {
    return;
  }

  staleScanQueued = true;

  enqueue(async () => {
    try {
      const redis = await getWorkerRedis();
      const now = Date.now();

      for await (const keys of redis.scanIterator({
        MATCH: `${TELEMETRY_LAST_SEEN_PREFIX}*`,
        COUNT: 100,
      })) {
        for (const key of keys) {
          const target = parseTelemetryLastSeenKey(key);

          if (!target) {
            continue;
          }

          const lastSeen = await redis.get(key);

          if (!isStaleTimestamp(lastSeen, now)) {
            continue;
          }

          try {
            await setSensorStatus(
              target.farmId,
              target.deviceId,
              "STALE",
              cacheTtlSeconds,
            );
          } finally {
            await redis.del(key);
          }
        }
      }
    } finally {
      staleScanQueued = false;
    }
  }, "mqtt_stale_scan_failed");
}

/**
 * Starts the background worker.
 *
 * Subscribes to:
 * - farm/+/device/+/status
 * - farm/+/device/+/telemetry
 */
export async function startMqttWorker(): Promise<MqttClient> {
  const cacheTtlSeconds = getCacheTtlSeconds();
  const client = connect(getMqttBrokerUrl(), {
    clean: true,
    connectTimeout: CONNECT_TIMEOUT_MS,
    keepalive: 30,
    reconnectPeriod: RECONNECT_DELAY_MS,
    clientId: `iot-automation-worker-${process.pid}-${randomUUID()}`,
  });
  const staleTimer = setInterval(
    () => markStaleSensors(cacheTtlSeconds),
    STALE_CHECK_INTERVAL_MS,
  );
  staleTimer.unref();

  client.on("connect", () => {
    logInfo("mqtt_worker_connected");

    client.subscribe([STATUS_TOPIC, TELEMETRY_TOPIC], { qos: 1 }, (error) => {
      if (error) {
        logError("mqtt_subscribe_failed", { error: error.message });
        return;
      }

      logInfo("mqtt_subscribed", {
        statusTopic: STATUS_TOPIC,
        telemetryTopic: TELEMETRY_TOPIC,
      });
    });
  });

  client.on("message", (topic, message) => {
    const deviceTopic = parseDeviceTopic(topic);

    if (!deviceTopic) {
      return;
    }

    enqueue(async () => {
      const payload = parseJsonObject(message);
      const envelope = createDeviceMessageEnvelope(deviceTopic, payload, topic);

      if (deviceTopic.kind === "status") {
        const key = await cacheStatusMessage(
          deviceTopic,
          envelope,
          cacheTtlSeconds,
        );
        logInfo("mqtt_cached_status", { key });
        await publishDeviceStatus(envelope);
      } else {
        const redis = await getWorkerRedis();
        const lastSeenKey = telemetryLastSeenKey(
          deviceTopic.farmId,
          deviceTopic.deviceId,
        );
        const previousLastSeen = await redis.get(lastSeenKey);
        const now = Date.now();

        await redis.set(lastSeenKey, now, {
          EX: TELEMETRY_LAST_SEEN_TTL_SECONDS,
        });
        await publishTelemetry(envelope);

        if (
          previousLastSeen === null ||
          isStaleTimestamp(previousLastSeen, now)
        ) {
          await setSensorStatus(
            deviceTopic.farmId,
            deviceTopic.deviceId,
            "ONLINE",
            cacheTtlSeconds,
          );
        }
      }

      logInfo("mqtt_published", {
        kind: deviceTopic.kind,
        channel: deviceChannel(envelope),
      });
    });
  });

  client.on("reconnect", () => {
    logWarn("mqtt_worker_reconnecting");
  });

  client.on("error", (error) => {
    logError("mqtt_worker_error", { error: error.message });
  });

  client.on("offline", () => {
    logWarn("mqtt_worker_offline");
  });

  let shuttingDown = false;

  const shutdown = async () => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    logInfo("mqtt_worker_shutting_down");

    clearInterval(staleTimer);
    await queue;

    await new Promise<void>((resolve) => {
      client.end(false, () => resolve());
    });

    if (redisClient?.isOpen) {
      await redisClient.quit();
    }

    process.exitCode = 0;
  };

  process.once("SIGINT", () => void shutdown());
  process.once("SIGTERM", () => void shutdown());

  return client;
}

// Auto-start only when executed directly, not when imported for tests.
if (process.argv[1]?.endsWith("mqttWorker.ts")) {
  startMqttWorker().catch((error: unknown) => {
    logError("mqtt_worker_start_failed", { error: errorMessage(error) });
    process.exitCode = 1;
  });
}
