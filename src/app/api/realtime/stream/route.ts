import type { NextRequest } from "next/server";
import {
  badRequestResponse,
  isObjectId,
  notFoundResponse,
  serverErrorResponse,
  unauthorizedResponse,
} from "@/lib/api-helpers";
import { canAccessOwner, getAuthenticatedUser } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getRedis } from "@/lib/redis";
import {
  deviceMessageKey,
  parseDeviceMessageEnvelope,
  type DeviceMessageEnvelope,
} from "@/lib/telemetry";

const HEARTBEAT_INTERVAL_MS = 15_000;

export async function GET(request: NextRequest) {
  const user = getAuthenticatedUser(request);

  if (!user) {
    return unauthorizedResponse();
  }

  const farmId = request.nextUrl.searchParams.get("farmId");

  if (!farmId || !isObjectId(farmId)) {
    return badRequestResponse("A valid farmId is required");
  }

  let devices: { id: string }[];

  try {
    const farm = await prisma.farm.findUnique({
      where: { id: farmId },
      select: {
        ownerId: true,
        devices: { select: { id: true } },
      },
    });

    if (!farm || !canAccessOwner(user, farm.ownerId)) {
      return notFoundResponse("Farm not found");
    }

    devices = farm.devices;
  } catch (error) {
    return serverErrorResponse("Authorize realtime stream", error);
  }

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
      await subscriber.pUnsubscribe().catch(() => undefined);
      await subscriber.quit().catch(() => undefined);
    }
  };

  request.signal.addEventListener("abort", () => void cleanup());

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const sendEvent = (event: string, envelope: DeviceMessageEnvelope) => {
        if (closed) {
          return;
        }

        controller.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(envelope)}\n\n`),
        );
      };

      try {
        const redis = await getRedis();

        if (devices.length > 0) {
          const statusKeys = devices.map((device) =>
            deviceMessageKey(farmId, device.id, "status"),
          );
          const cachedStatuses = await redis.mGet(statusKeys);

          for (const cached of cachedStatuses) {
            if (!cached) {
              continue;
            }

            const envelope = parseDeviceMessageEnvelope(cached);

            if (envelope) {
              sendEvent("status", envelope);
            }
          }
        }

        subscriber = redis.duplicate();
        await subscriber.connect();

        const handleMessage = (message: string) => {
          const envelope = parseDeviceMessageEnvelope(message);

          if (!envelope || envelope.farmId !== farmId) {
            return;
          }

          sendEvent(envelope.kind, envelope);
        };

        await subscriber.pSubscribe(`status:${farmId}:*`, handleMessage);
        await subscriber.pSubscribe(`telemetry:${farmId}:*`, handleMessage);

        controller.enqueue(encoder.encode(`: connected\n\n`));

        heartbeat = setInterval(() => {
          if (!closed) {
            controller.enqueue(encoder.encode(`: ping\n\n`));
          }
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
