import { randomUUID } from "crypto";
import { connect, type MqttClient } from "mqtt";

const COMMAND_TOPIC_SUFFIX = "command";
const DEFAULT_PUBLISH_TIMEOUT_MS = 10_000;
const ID_PATTERN = /^[A-Za-z0-9_-]{1,128}$/;
const ALLOWED_PROTOCOLS = new Set(["mqtt:", "mqtts:", "ws:", "wss:"]);

interface PublisherState {
  client: MqttClient | null;
  connection: Promise<MqttClient> | null;
}

const globalForMqtt = globalThis as unknown as {
  mqttPublisherState?: PublisherState;
};

const state: PublisherState = globalForMqtt.mqttPublisherState ?? {
  client: null,
  connection: null,
};

if (process.env.NODE_ENV !== "production") {
  globalForMqtt.mqttPublisherState = state;
}

/** Reads and validates the broker URL before any connection attempt. */
export function getMqttBrokerUrl(): string {
  const url = process.env.MQTT_BROKER_URL;

  if (!url) {
    throw new Error("MQTT_BROKER_URL is not configured");
  }

  const parsed = new URL(url);

  if (!ALLOWED_PROTOCOLS.has(parsed.protocol)) {
    throw new Error(
      "MQTT_BROKER_URL must use mqtt, mqtts, ws, or wss protocol",
    );
  }

  if (process.env.NODE_ENV === "production") {
    if (parsed.protocol !== "mqtts:" && parsed.protocol !== "wss:") {
      throw new Error(
        "MQTT_BROKER_URL must use mqtts or wss protocol in production",
      );
    }

    if (!parsed.username || !parsed.password) {
      throw new Error("MQTT_BROKER_URL must include credentials in production");
    }
  }

  return url;
}

/** Builds the command topic for one device without allowing topic injection. */
export function buildCommandTopic(farmId: string, deviceId: string): string {
  for (const [label, value] of [
    ["farmId", farmId],
    ["deviceId", deviceId],
  ] as const) {
    if (!ID_PATTERN.test(value)) {
      throw new Error(`Invalid ${label}`);
    }
  }

  return `farm/${farmId}/device/${deviceId}/${COMMAND_TOPIC_SUFFIX}`;
}

/** Creates one long-lived MQTT client with automatic reconnects. */
function createMqttClient(): MqttClient {
  const client = connect(getMqttBrokerUrl(), {
    clean: true,
    connectTimeout: DEFAULT_PUBLISH_TIMEOUT_MS,
    keepalive: 30,
    reconnectPeriod: 2_000,
    clientId: `iot-automation-publisher-${process.pid}-${randomUUID()}`,
  });

  // The broker emits this for network/auth problems; keep the worker alive so
  // the built-in reconnect loop can recover.
  client.on("error", (error) => {
    console.error("MQTT publisher error:", error.message);
  });

  client.on("close", () => {
    if (state.client === client) {
      state.client = null;
      state.connection = null;
    }
  });

  return client;
}

/** Returns a connected shared publisher client. */
export function getMqttClient(): Promise<MqttClient> {
  if (state.client?.connected) {
    return Promise.resolve(state.client);
  }

  if (state.connection) {
    return state.connection;
  }

  const client = createMqttClient();

  state.connection = new Promise<MqttClient>((resolve, reject) => {
    const onConnect = () => {
      cleanup();
      resolve(client);
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      client.off("connect", onConnect);
      client.off("error", onError);
    };

    client.once("connect", onConnect);
    client.once("error", onError);
  }).catch((error: unknown) => {
    state.client = null;
    state.connection = null;
    throw error;
  });

  state.client = client;
  return state.connection;
}

/** Resolves only after the broker acknowledges the QoS 1 publish. */
function publishWithAck(
  client: MqttClient,
  topic: string,
  message: string,
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let settled = false;

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("MQTT publish timed out"));
    }, DEFAULT_PUBLISH_TIMEOUT_MS);

    client.publish(topic, message, { qos: 1, retain: false }, (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);

      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
}

/**
 * Publishes a JSON command to:
 * farm/{farmId}/device/{deviceId}/command
 */
export async function sendDeviceCommand(
  farmId: string,
  deviceId: string,
  payload: object,
): Promise<void> {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) {
    throw new TypeError("Command payload must be a JSON object");
  }

  const topic = buildCommandTopic(farmId, deviceId);

  let message: string;

  try {
    message = JSON.stringify(payload);
  } catch (error) {
    throw new Error(
      `Command payload is not JSON serializable: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  try {
    const client = await getMqttClient();
    await publishWithAck(client, topic, message);
  } catch (error) {
    console.error(
      `Failed to publish device command to ${topic}:`,
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
}

/** Closes the shared publisher on process shutdown. */
export async function disconnectMqttPublisher(): Promise<void> {
  const client = state.client;

  state.client = null;
  state.connection = null;

  if (!client) {
    return;
  }

  await new Promise<void>((resolve) => {
    client.end(false, () => resolve());
  });
}
