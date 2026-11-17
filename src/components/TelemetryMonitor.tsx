"use client";

import { useEffect, useState } from "react";
import {
  parseDeviceMessageEnvelope,
  type DeviceMessageEnvelope,
} from "@/lib/telemetry";

interface FarmOption {
  id: string;
  name: string;
}

interface DeviceOption {
  id: string;
  name: string;
  type: string;
}

type ConnectionState = "idle" | "connecting" | "connected" | "reconnecting";

const FIELD_CLASS =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

export function TelemetryMonitor() {
  const [farms, setFarms] = useState<FarmOption[]>([]);
  const [devices, setDevices] = useState<DeviceOption[]>([]);
  const [farmId, setFarmId] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [events, setEvents] = useState<DeviceMessageEnvelope[]>([]);
  const [connectionState, setConnectionState] =
    useState<ConnectionState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadFarms = async () => {
      try {
        const response = await fetch("/api/farms", { credentials: "same-origin" });
        const data = (await response.json()) as {
          farms?: FarmOption[];
          error?: string;
        };

        if (!response.ok) {
          setError(data.error ?? "Unable to load farms");
          return;
        }

        const loadedFarms = data.farms ?? [];
        setFarms(loadedFarms);
        setFarmId(loadedFarms[0]?.id ?? "");
      } catch {
        setError("Network error while loading farms");
      }
    };

    void loadFarms();
  }, []);

  useEffect(() => {
    if (!farmId) {
      return;
    }

    const loadDevices = async () => {
      try {
        const response = await fetch(
          `/api/devices?farmId=${encodeURIComponent(farmId)}`,
          { credentials: "same-origin" },
        );
        const data = (await response.json()) as {
          devices?: DeviceOption[];
          error?: string;
        };

        if (!response.ok) {
          setError(data.error ?? "Unable to load devices");
          return;
        }

        const loadedDevices = data.devices ?? [];
        setDevices(loadedDevices);
        setEvents([]);
        setDeviceId(loadedDevices[0]?.id ?? "");
        setConnectionState(loadedDevices.length > 0 ? "connecting" : "idle");
      } catch {
        setError("Network error while loading devices");
      }
    };

    void loadDevices();
  }, [farmId]);

  useEffect(() => {
    if (!farmId || !deviceId) {
      return;
    }

    let disposed = false;
    const configuredUrl = process.env.NEXT_PUBLIC_WS_URL;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const baseUrl = (configuredUrl ?? `${protocol}//${window.location.hostname}:3001`)
      .trim()
      .replace(/\/$/, "");
    const socket = new WebSocket(
      `${baseUrl}/ws?farmId=${encodeURIComponent(farmId)}&deviceId=${encodeURIComponent(deviceId)}`,
    );

    socket.onopen = () => {
      if (!disposed) {
        setError(null);
        setConnectionState("connecting");
      }
    };

    socket.onerror = () => {
      if (!disposed) {
        setConnectionState("reconnecting");
        setError("WebSocket unavailable. Start npm run ws:server.");
      }
    };

    socket.onclose = () => {
      if (!disposed) {
        setConnectionState("reconnecting");
      }
    };

    socket.onmessage = (event) => {
      if (disposed) {
        return;
      }

      try {
        const frame: unknown = JSON.parse(event.data as string);

        if (typeof frame !== "object" || frame === null) {
          return;
        }

        const candidate = frame as { type?: unknown; data?: unknown };

        if (candidate.type === "ready") {
          setError(null);
          setConnectionState("connected");
          return;
        }

        if (
          candidate.type !== "telemetry" ||
          typeof candidate.data !== "object" ||
          candidate.data === null
        ) {
          return;
        }

        const envelope = parseDeviceMessageEnvelope(
          JSON.stringify(candidate.data),
        );

        if (envelope) {
          setEvents((current) => [envelope, ...current].slice(0, 20));
        }
      } catch {
        return;
      }
    };

    return () => {
      disposed = true;
      socket.close();
    };
  }, [farmId, deviceId]);

  function handleFarmChange(nextFarmId: string) {
    setFarmId(nextFarmId);
    setDevices([]);
    setDeviceId("");
    setEvents([]);
    setError(null);
    setConnectionState("idle");
  }

  function handleDeviceChange(nextDeviceId: string) {
    setDeviceId(nextDeviceId);
    setEvents([]);
    setError(null);
    setConnectionState(nextDeviceId ? "connecting" : "idle");
  }

  const latestEvent = events[0] ?? null;
  const visibleConnectionState =
    farmId && deviceId ? connectionState : "idle";

  return (
    <section className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-6 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none sm:p-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-900 dark:text-white">
            Live telemetry
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Messages flow from MQTT through Redis Pub/Sub and WebSocket into this page.
          </p>
        </div>

        <span
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            visibleConnectionState === "connected"
              ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          {visibleConnectionState}
        </span>
      </div>

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Farm
          <select
            value={farmId}
            onChange={(event) => handleFarmChange(event.target.value)}
            className={`${FIELD_CLASS} mt-2`}
          >
            <option value="">Select a farm</option>
            {farms.map((farm) => (
              <option key={farm.id} value={farm.id}>
                {farm.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
          Device
          <select
            value={deviceId}
            onChange={(event) => handleDeviceChange(event.target.value)}
            className={`${FIELD_CLASS} mt-2`}
            disabled={!deviceId}
          >
            <option value="">Select a device</option>
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.name} ({device.type})
              </option>
            ))}
          </select>
        </label>
      </div>

      {error && (
        <div
          role="alert"
          className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
        >
          {error}
        </div>
      )}

      <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Latest payload
        </p>
        <pre className="mt-2 overflow-x-auto text-sm text-slate-800 dark:text-slate-200">
          {latestEvent
            ? JSON.stringify(latestEvent.payload, null, 2)
            : "Waiting for telemetry..."}
        </pre>
      </div>

      <div className="mt-6">
        <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">
          Recent events
        </h3>
        <div className="mt-3 space-y-2">
          {events.length === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Publish to the telemetry topic to see events here.
            </p>
          ) : (
            events.map((event) => (
              <div
                key={`${event.receivedAt}-${event.topic}`}
                className="rounded-lg border border-slate-200 px-4 py-3 text-sm dark:border-slate-800"
              >
                <div className="flex items-center justify-between gap-4">
                  <span className="truncate font-mono text-xs text-slate-500 dark:text-slate-400">
                    {event.topic}
                  </span>
                  <span className="shrink-0 text-xs text-slate-400">
                    {new Date(event.receivedAt).toLocaleTimeString()}
                  </span>
                </div>
                <pre className="mt-2 overflow-x-auto text-slate-800 dark:text-slate-200">
                  {JSON.stringify(event.payload)}
                </pre>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
