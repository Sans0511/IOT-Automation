import type { NextRequest } from "next/server";
import { canAccessOwner, getAuthenticatedUser } from "@/lib/api-auth";
import {
  badRequestResponse,
  isObjectId,
  notFoundResponse,
  serverErrorResponse,
  unauthorizedResponse,
} from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { getRedis } from "@/lib/redis";
import {
  deviceMessageKey,
  parseDeviceMessageEnvelope,
  telemetryChannel,
} from "@/lib/telemetry";

const HEARTBEAT_INTERVAL_MS = 15_000;

export async function GET(request: NextRequest) {
  const user = getAuthenticatedUser(request);

  if (!user) {
    return unauthorizedResponse();
  }

  const farmId = request.nextUrl.searchParams.get("farmId");
  const deviceId = request.nextUrl.searchParams.get("deviceId");

  if (
    !farmId ||
    !deviceId ||
    !isObjectId(farmId) ||
    !isObjectId(deviceId)
  ) {
    return badRequestResponse("Valid farmId and deviceId are required");
  }

  try {
    const device = await prisma.device.findFirst({
      where: { id: deviceId, farmId },
      include: { farm: { select: { ownerId: true } } },
    });

    if (!device || !canAccessOwner(user, device.farm.ownerId)) {
      return notFoundResponse("Device not found");
    }
  } catch (error) {
    return serverErrorResponse("Authorize telemetry stream", error);
  }

  const channel = telemetryChannel(farmId, deviceId);
  const encoder = new TextEncoder();
  let subscriber: Awaited<ReturnType<typeof getRedis>> | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;
  let cleanedUp = false;
  let closed = false;

  const cleanup = async () => {
    if (cleanedUp) {
      return;
    }

    cleanedUp = true;

    if (heartbeat) {
      clearInterval(heartbeat);
    }

    if (subscriber?.isOpen) {
      await subscriber.unsubscribe(channel).catch(() => undefined);
      await subscriber.quit().catch(() => undefined);
    }
  };

  request.signal.addEventListener("abort", () => void cleanup());

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (value: string) => {
        if (closed) {
          return;
        }

        controller.enqueue(encoder.encode(value));
      };

      try {
        const redis = await getRedis();
        const cached = await redis.get(
          deviceMessageKey(farmId, deviceId, "telemetry"),
        );
        const snapshot = cached ? parseDeviceMessageEnvelope(cached) : null;

        if (snapshot) {
          send(`event: telemetry\ndata: ${JSON.stringify(snapshot)}\n\n`);
        }

        subscriber = redis.duplicate();
        await subscriber.connect();
        await subscriber.subscribe(channel, (message) => {
          const envelope = parseDeviceMessageEnvelope(message);

          if (envelope) {
            send(`event: telemetry\ndata: ${JSON.stringify(envelope)}\n\n`);
          }
        });

        send(`: connected\n\n`);

        heartbeat = setInterval(() => {
          send(`: ping\n\n`);
        }, HEARTBEAT_INTERVAL_MS);
      } catch (error) {
        closed = true;
        await cleanup();
        controller.error(error);
      }
    },
    async cancel() {
      closed = true;
      await cleanup();
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-cache, no-transform",
      "Content-Type": "text/event-stream; charset=utf-8",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
