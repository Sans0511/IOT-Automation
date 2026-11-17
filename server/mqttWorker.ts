import "dotenv/config";

import { randomUUID } from "crypto";
import { connect, type MqttClient } from "mqtt";
import { getMqttBrokerUrl } from "../src/lib/mqttClient";
import { getRedis, publishTelemetry } from "../src/lib/redis";
import {
  deviceMessageKey,
  telemetryChannel,
  type DeviceMessageEnvelope,
} from "../src/lib/telemetry";

const STATUS_TOPIC = "farm/+/device/+/status";
const TELEMETRY_TOPIC = "farm/+/device/+/telemetry";
const TOPIC_PATTERN = /^farm\/([^/]+)\/device\/([^/]+)\/(status|telemetry)$/;
const DEFAULT_CACHE_TTL_SECONDS = 24 * 60 * 60;
const RECONNECT_DELAY_MS = 2_000;
const CONNECT_TIMEOUT_MS = 10_000;

type MessageKind = "status" | "telemetry";

interface DeviceTopic {
  farmId: string;
  deviceId: string;
  kind: MessageKind;
}

let redisClient: Awaited<ReturnType<typeof getRedis>> | null = null;
let queue: Promise<void> = Promise.resolve();

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

/** Stores the newest message under a predictable key with an expiry. */
async function cacheDeviceMessage(
  deviceTopic: DeviceTopic,
  payload: Record<string, unknown>,
  topic: string,
  ttlSeconds: number,
): Promise<{ key: string; envelope: DeviceMessageEnvelope }> {
  if (!redisClient) {
    redisClient = await getRedis();
  }

  const key = deviceMessageKey(
    deviceTopic.farmId,
    deviceTopic.deviceId,
    deviceTopic.kind,
  );
  const envelope: DeviceMessageEnvelope = {
    farmId: deviceTopic.farmId,
    deviceId: deviceTopic.deviceId,
    kind: deviceTopic.kind,
    payload,
    topic,
    receivedAt: new Date().toISOString(),
  };

  await redisClient.set(key, JSON.stringify(envelope), { EX: ttlSeconds });

  return { key, envelope };
}

/** Serializes Redis writes so a slower write cannot overwrite newer data. */
function enqueue(task: () => Promise<void>): void {
  queue = queue.then(task).catch((error: unknown) => {
    console.error(
      "MQTT message handling failed:",
      error instanceof Error ? error.message : String(error),
    );
  });
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

  client.on("connect", () => {
    console.log("MQTT worker connected");

    client.subscribe([STATUS_TOPIC, TELEMETRY_TOPIC], { qos: 1 }, (error) => {
      if (error) {
        console.error("MQTT subscribe failed:", error.message);
        return;
      }

      console.log(`MQTT subscribed: ${STATUS_TOPIC}, ${TELEMETRY_TOPIC}`);
    });
  });

  client.on("message", (topic, message) => {
    const deviceTopic = parseDeviceTopic(topic);

    if (!deviceTopic) {
      return;
    }

    enqueue(async () => {
      const payload = parseJsonObject(message);
      const { key, envelope } = await cacheDeviceMessage(
        deviceTopic,
        payload,
        topic,
        cacheTtlSeconds,
      );

      console.log(`Cached ${deviceTopic.kind} -> ${key}`);

      if (deviceTopic.kind === "telemetry") {
        await publishTelemetry(envelope);
        console.log(
          `Published telemetry -> ${telemetryChannel(envelope.farmId, envelope.deviceId)}`,
        );
      }
    });
  });

  client.on("reconnect", () => {
    console.warn("MQTT worker reconnecting...");
  });

  client.on("error", (error) => {
    console.error("MQTT worker error:", error.message);
  });

  client.on("offline", () => {
    console.warn("MQTT worker offline");
  });

  let shuttingDown = false;

  const shutdown = async () => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    console.log("MQTT worker shutting down...");

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
    console.error(
      "MQTT worker failed to start:",
      error instanceof Error ? error.message : String(error),
    );
    process.exitCode = 1;
  });
}
