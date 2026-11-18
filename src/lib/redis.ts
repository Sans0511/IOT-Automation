import { createClient, type RedisClientType } from "redis";
import {
  deviceChannel,
  deviceMessageKey,
  statusChannel,
  type DeviceMessageEnvelope,
} from "./telemetry";

type Client = RedisClientType;

interface RedisState {
  client: Client | null;
  connection: Promise<Client> | null;
}

const globalForRedis = globalThis as unknown as {
  redisState?: RedisState;
};

const state: RedisState = globalForRedis.redisState ?? {
  client: null,
  connection: null,
};

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redisState = state;
}

function getRedisUrl(): string {
  const url = process.env.REDIS_URL;

  if (!url) {
    throw new Error("REDIS_URL is not configured");
  }

  return url;
}

function createRedisClient(): Client {
  const client = createClient({
    url: getRedisUrl(),
    socket: {
      reconnectStrategy: (retries) => Math.min(retries * 200, 5_000),
    },
  });

  client.on("error", (error) => {
    console.error("Redis client error:", error);
  });

  client.on("end", () => {
    if (state.client === client) {
      state.client = null;
      state.connection = null;
    }
  });

  return client;
}

export async function getRedis(): Promise<Client> {
  if (state.client?.isReady) {
    return state.client;
  }

  if (state.connection) {
    return state.connection;
  }

  const client = createRedisClient();
  state.client = client;
  state.connection = client.connect().catch((error: unknown) => {
    state.client = null;
    state.connection = null;
    throw error;
  });

  return state.connection;
}

export async function cacheDeviceStatus(
  envelope: DeviceMessageEnvelope,
  ttlSeconds = 24 * 60 * 60,
): Promise<void> {
  const redis = await getRedis();
  await redis.set(
    deviceMessageKey(envelope.farmId, envelope.deviceId, "status"),
    JSON.stringify(envelope),
    { EX: ttlSeconds },
  );
}

/** Publishes a device message to the per-device real-time channel. */
export async function publishTelemetry(
  envelope: DeviceMessageEnvelope,
): Promise<void> {
  const redis = await getRedis();
  await redis.publish(deviceChannel(envelope), JSON.stringify(envelope));
}

export async function publishDeviceStatus(
  envelope: DeviceMessageEnvelope,
): Promise<void> {
  const redis = await getRedis();
  await redis.publish(
    statusChannel(envelope.farmId, envelope.deviceId),
    JSON.stringify(envelope),
  );
}

function refreshTokenKey(userId: string): string {
  return `refresh_token:${userId}`;
}

export async function storeRefreshToken(
  userId: string,
  token: string,
  ttlSeconds: number,
): Promise<void> {
  const redis = await getRedis();
  await redis.set(refreshTokenKey(userId), token, { EX: ttlSeconds });
}

export async function getRefreshToken(userId: string): Promise<string | null> {
  const redis = await getRedis();
  return redis.get(refreshTokenKey(userId));
}

export async function deleteRefreshToken(userId: string): Promise<void> {
  const redis = await getRedis();
  await redis.del(refreshTokenKey(userId));
}
