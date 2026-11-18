import { createHash } from "node:crypto";
import { createClient, type RedisClientType } from "redis";
import { DEFAULT_CACHE_TTL_SECONDS } from "./freshness";
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

export interface RefreshSession {
  tokenHash: string;
  familyId: string;
  expiresAtSeconds: number;
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
  ttlSeconds = DEFAULT_CACHE_TTL_SECONDS,
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

export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function refreshTokenKey(userId: string): string {
  return `refresh_token:${userId}`;
}

function refreshFamilyKey(familyId: string): string {
  return `refresh_family:${familyId}`;
}

function sessionTtlSeconds(expiresAtSeconds: number): number {
  return Math.max(1, expiresAtSeconds - Math.floor(Date.now() / 1000));
}

function isRefreshSession(value: unknown): value is RefreshSession {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const session = value as Record<string, unknown>;

  return (
    typeof session.tokenHash === "string" &&
    typeof session.familyId === "string" &&
    typeof session.expiresAtSeconds === "number" &&
    Number.isFinite(session.expiresAtSeconds)
  );
}

export async function getRefreshSession(
  userId: string,
): Promise<RefreshSession | null> {
  const redis = await getRedis();
  const raw = await redis.get(refreshTokenKey(userId));

  if (!raw) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(raw);
    return isRefreshSession(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function storeRefreshSession(
  userId: string,
  session: RefreshSession,
): Promise<void> {
  const redis = await getRedis();
  const ttl = sessionTtlSeconds(session.expiresAtSeconds);

  await redis
    .multi()
    .set(refreshTokenKey(userId), JSON.stringify(session), { EX: ttl })
    .sAdd(refreshFamilyKey(session.familyId), userId)
    .expire(refreshFamilyKey(session.familyId), ttl)
    .exec();
}

export async function deleteRefreshSession(userId: string): Promise<void> {
  const redis = await getRedis();
  const session = await getRefreshSession(userId);
  const multi = redis.multi().del(refreshTokenKey(userId));

  if (session) {
    multi.sRem(refreshFamilyKey(session.familyId), userId);
  }

  await multi.exec();
}

export async function revokeRefreshFamily(familyId: string): Promise<void> {
  const redis = await getRedis();
  const members = await redis.sMembers(refreshFamilyKey(familyId));
  const keys = Array.from(members, (member) =>
    refreshTokenKey(String(member)),
  );

  await redis.multi().del([...keys, refreshFamilyKey(familyId)]).exec();
}
