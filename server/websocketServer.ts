import "dotenv/config";

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { connect, type MqttClient } from "mqtt";
import { WebSocket, WebSocketServer } from "ws";
import {
  canAccessOwner,
  getAuthenticatedUserFromCookieHeader,
} from "../src/lib/api-auth";
import { logError, logInfo, logWarn } from "../src/lib/logger";
import { getMqttBrokerUrl } from "../src/lib/mqttClient";
import { prisma } from "../src/lib/prisma";
import { getRedis } from "../src/lib/redis";
import {
  deviceMessageKey,
  parseDeviceMessageEnvelope,
  type DeviceMessageEnvelope,
} from "../src/lib/telemetry";

const OBJECT_ID_PATTERN = /^[a-f\d]{24}$/i;
const HEARTBEAT_INTERVAL_MS = 15_000;
const DEFAULT_PORT = 3001;
const MQTT_READY_TIMEOUT_MS = 2_000;
const TELEMETRY_PATTERN = "telemetry:*";
const STATUS_PATTERN = "status:*";
const ALL_DEVICES = "all";
const DEFAULT_ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "http://127.0.0.1:3000",
];

type RedisClient = Awaited<ReturnType<typeof getRedis>>;

interface DependencyHealth {
  name: string;
  healthy: boolean;
  error?: string;
}

type StreamFrame =
  | { type: "ready"; farmId: string; deviceId: string }
  | { type: "telemetry"; data: DeviceMessageEnvelope }
  | { type: "status"; data: DeviceMessageEnvelope };

interface StreamClient {
  farmId: string;
  deviceId: string;
}

const clients = new Map<WebSocket, StreamClient>();
let subscriber: RedisClient | null = null;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function getPort(): number {
  const raw = process.env.WS_PORT;

  if (!raw) {
    return DEFAULT_PORT;
  }

  const port = Number(raw);

  if (!Number.isInteger(port) || port <= 0 || port > 65_535) {
    throw new Error("WS_PORT must be a valid port number");
  }

  return port;
}

function getAllowedOrigins(): string[] {
  const configured = process.env.WEBSOCKET_ALLOWED_ORIGINS
    ?.split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (configured?.length) {
    return configured;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error("WEBSOCKET_ALLOWED_ORIGINS is required in production");
  }

  return DEFAULT_ALLOWED_ORIGINS;
}

function isAllowedOrigin(request: IncomingMessage): boolean {
  const origin = request.headers.origin;

  if (!origin) {
    return process.env.NODE_ENV !== "production";
  }

  return getAllowedOrigins().includes(origin);
}

function sendFrame(socket: WebSocket, frame: StreamFrame): void {
  if (socket.readyState !== WebSocket.OPEN) {
    return;
  }

  socket.send(JSON.stringify(frame));
}

async function handleConnection(
  socket: WebSocket,
  request: IncomingMessage,
): Promise<void> {
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let cleanedUp = false;

  const cleanup = () => {
    if (cleanedUp) {
      return;
    }

    cleanedUp = true;
    clients.delete(socket);

    if (heartbeat) {
      clearInterval(heartbeat);
    }
  };

  const fail = async (code: number, reason: string) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.close(code, reason);
    }

    cleanup();
  };

  try {
    const host = request.headers.host ?? "localhost";
    const requestUrl = new URL(request.url ?? "/ws", `http://${host}`);
    const farmId = requestUrl.searchParams.get("farmId");
    const rawDeviceId = requestUrl.searchParams.get("deviceId");

    if (!farmId || !OBJECT_ID_PATTERN.test(farmId)) {
      await fail(4400, "A valid farmId is required");
      return;
    }

    const farmWide = !rawDeviceId || rawDeviceId === ALL_DEVICES;
    const deviceId = farmWide ? ALL_DEVICES : rawDeviceId;

    if (deviceId !== ALL_DEVICES && !OBJECT_ID_PATTERN.test(deviceId)) {
      await fail(4400, "A valid deviceId is required");
      return;
    }

    const user = getAuthenticatedUserFromCookieHeader(request.headers.cookie);

    if (!user) {
      await fail(4401, "Authentication required");
      return;
    }

    const farm = await prisma.farm.findUnique({
      where: { id: farmId },
      select: { ownerId: true },
    });

    if (!farm || !canAccessOwner(user, farm.ownerId)) {
      await fail(4403, "Farm not found");
      return;
    }

    if (deviceId !== ALL_DEVICES) {
      const device = await prisma.device.findFirst({
        where: { id: deviceId, farmId },
        select: { id: true },
      });

      if (!device) {
        await fail(4403, "Device not found");
        return;
      }
    }

    logInfo("websocket_client_connected", { farmId, deviceId });

    const redis = await getRedis();

    if (deviceId === ALL_DEVICES) {
      const devices = await prisma.device.findMany({
        where: { farmId },
        select: { id: true },
      });
      const statusKeys = devices.map((device) =>
        deviceMessageKey(farmId, device.id, "status"),
      );

      if (statusKeys.length > 0) {
        const cachedStatuses = await redis.mGet(statusKeys);

        for (const cached of cachedStatuses) {
          const snapshot = cached
            ? parseDeviceMessageEnvelope(cached)
            : null;

          if (snapshot) {
            sendFrame(socket, { type: "status", data: snapshot });
          }
        }
      }
    } else {
      const cachedStatus = await redis.get(
        deviceMessageKey(farmId, deviceId, "status"),
      );
      const statusSnapshot = cachedStatus
        ? parseDeviceMessageEnvelope(cachedStatus)
        : null;

      if (statusSnapshot) {
        sendFrame(socket, { type: "status", data: statusSnapshot });
      }
    }

    clients.set(socket, { farmId, deviceId });
    sendFrame(socket, { type: "ready", farmId, deviceId });

    let isAlive = true;

    socket.on("pong", () => {
      isAlive = true;
    });

    heartbeat = setInterval(() => {
      if (!isAlive) {
        socket.terminate();
        return;
      }

      isAlive = false;
      socket.ping();
    }, HEARTBEAT_INTERVAL_MS);

    socket.on("close", () => {
      logInfo("websocket_client_disconnected", { farmId, deviceId });
      cleanup();
    });

    socket.on("error", (error) => {
      logError("websocket_client_error", { error: error.message });
      cleanup();
    });
  } catch (error) {
    logError("websocket_connection_failed", { error: errorMessage(error) });
    await fail(1011, "Unable to start device stream");
  }
}

async function checkDependency(
  name: string,
  check: () => Promise<unknown>,
): Promise<DependencyHealth> {
  try {
    await check();
    return { name, healthy: true };
  } catch (error) {
    return { name, healthy: false, error: errorMessage(error) };
  }
}

async function checkMqttDependency(): Promise<DependencyHealth> {
  try {
    const url = getMqttBrokerUrl();
    const healthy = await new Promise<boolean>((resolve) => {
      const client: MqttClient = connect(url, {
        reconnectPeriod: 0,
        connectTimeout: MQTT_READY_TIMEOUT_MS,
        clientId: `iot-automation-health-${process.pid}-${Date.now()}`,
      });
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | null = null;

      const finish = (result: boolean) => {
        if (settled) {
          return;
        }

        settled = true;

        if (timer) {
          clearTimeout(timer);
        }

        try {
          client.end(true);
        } finally {
          resolve(result);
        }
      };

      timer = setTimeout(() => finish(false), MQTT_READY_TIMEOUT_MS);
      client.once("connect", () => finish(true));
      client.once("error", () => finish(false));
    });

    return { name: "mqtt", healthy };
  } catch (error) {
    return { name: "mqtt", healthy: false, error: errorMessage(error) };
  }
}

async function handleReady(response: ServerResponse): Promise<void> {
  const dependencies = await Promise.all([
    checkDependency("mongodb", () => prisma.$runCommandRaw({ ping: 1 })),
    checkDependency("redis", async () => {
      const redis = await getRedis();
      await redis.ping();
    }),
    checkMqttDependency(),
  ]);
  const healthy = dependencies.every((dependency) => dependency.healthy);

  response.writeHead(healthy ? 200 : 503, {
    "Content-Type": "application/json",
  });
  response.end(JSON.stringify({ healthy, dependencies }));
}

const port = getPort();
const server = createServer((request, response) => {
  if (request.url === "/health") {
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ status: "ok" }));
    return;
  }

  if (request.url === "/health/ready") {
    void handleReady(response);
    return;
  }

  response.writeHead(404);
  response.end();
});

const wss = new WebSocketServer({
  server,
  path: "/ws",
  verifyClient: (info, done) => {
    if (!isAllowedOrigin(info.req)) {
      logWarn("websocket_origin_blocked", {
        origin: String(info.req.headers.origin ?? "undefined"),
      });
      done(false, 403, "Forbidden origin");
      return;
    }

    done(true);
  },
});

wss.on("connection", (socket, request) => {
  void handleConnection(socket, request);
});

async function start() {
  const redis = await getRedis();
  subscriber = redis.duplicate();
  await subscriber.connect();

  const handleMessage = (message: string) => {
    const envelope = parseDeviceMessageEnvelope(message);

    if (!envelope) {
      return;
    }

    const frame: StreamFrame =
      envelope.kind === "status"
        ? { type: "status", data: envelope }
        : { type: "telemetry", data: envelope };
    let recipients = 0;

    for (const [socket, client] of clients) {
      const wantsDevice =
        client.deviceId === ALL_DEVICES ||
        client.deviceId === envelope.deviceId;

      if (
        wantsDevice &&
        client.farmId === envelope.farmId &&
        socket.readyState === WebSocket.OPEN
      ) {
        sendFrame(socket, frame);
        recipients += 1;
      }
    }

    if (recipients > 0) {
      logInfo("websocket_fanout", {
        kind: envelope.kind,
        farmId: envelope.farmId,
        deviceId: envelope.deviceId,
        recipients,
      });
    }
  };

  await subscriber.pSubscribe(TELEMETRY_PATTERN, handleMessage);
  await subscriber.pSubscribe(STATUS_PATTERN, handleMessage);

  server.listen(port, () => {
    logInfo("websocket_server_listening", { port });
  });
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    logInfo("websocket_server_shutting_down");
    clients.forEach((_client, socket) => socket.close());
    wss.close(() => {
      server.close(() => {
        void subscriber?.pUnsubscribe().catch(() => undefined);
        void subscriber?.quit().catch(() => undefined);
        process.exit(0);
      });
    });
  });
}

void start().catch((error) => {
  logError("websocket_server_start_failed", { error: errorMessage(error) });
  process.exit(1);
});
