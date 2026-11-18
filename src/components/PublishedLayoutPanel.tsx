"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import type { PublishedFarm } from "@/lib/published-layout";
import {
  getDeviceRuntimeStatus,
  parseDeviceMessageEnvelope,
  type DeviceMessageEnvelope,
} from "@/lib/telemetry";

type StatusMap = Record<string, DeviceMessageEnvelope>;
type StatusConnectionState = "connecting" | "connected" | "reconnecting";

const FarmLayoutViewer = dynamic(
  () => import("@/components/farm-layout/FarmLayoutViewer"),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 w-full animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
    ),
  },
);

export function PublishedLayoutPanel({ farm }: { farm: PublishedFarm | null }) {
  const farmId = farm?.id;
  const devices = farm?.devices;
  const [statuses, setStatuses] = useState<StatusMap>(
    () => farm?.statuses ?? {},
  );
  const [statusConnection, setStatusConnection] =
    useState<StatusConnectionState>("connecting");

  useEffect(() => {
    if (!farmId) {
      return;
    }

    let disposed = false;
    const configuredUrl = process.env.NEXT_PUBLIC_WS_URL;
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const baseUrl = (
      configuredUrl ?? `${protocol}//${window.location.hostname}:3001`
    )
      .trim()
      .replace(/\/$/, "");
    const socket = new WebSocket(
      `${baseUrl}/ws?farmId=${encodeURIComponent(farmId)}&deviceId=all`,
    );

    socket.onopen = () => {
      if (!disposed) {
        setStatusConnection("connecting");
      }
    };

    socket.onerror = () => {
      if (!disposed) {
        setStatusConnection("reconnecting");
      }
    };

    socket.onclose = () => {
      if (!disposed) {
        setStatusConnection("reconnecting");
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
          setStatusConnection("connected");
          return;
        }

        if (
          candidate.type !== "status" ||
          typeof candidate.data !== "object" ||
          candidate.data === null
        ) {
          return;
        }

        const envelope = parseDeviceMessageEnvelope(
          JSON.stringify(candidate.data),
        );

        if (!envelope || envelope.farmId !== farmId) {
          return;
        }

        setStatuses((current) => ({
          ...current,
          [envelope.deviceId]: envelope,
        }));
      } catch {
        return;
      }
    };

    return () => {
      disposed = true;
      socket.close();
    };
  }, [farmId]);

  const runtimeByDevice = useMemo(
    () =>
      new Map(
        (devices ?? []).map((device) => [
          device.id,
          getDeviceRuntimeStatus(statuses[device.id], device.type),
        ]),
      ),
    [devices, statuses],
  );
  const activeCount = useMemo(
    () =>
      Array.from(runtimeByDevice.values()).filter((status) => status.active)
        .length,
    [runtimeByDevice],
  );
  const onlineCount = useMemo(
    () =>
      Array.from(runtimeByDevice.values()).filter((status) => status.online)
        .length,
    [runtimeByDevice],
  );
  const farmName = farm?.name ?? "Pranithi Farms";
  const statusLabel =
    statusConnection === "connected"
      ? "Live status"
      : statusConnection === "reconnecting"
        ? "Status reconnecting"
        : "Status connecting";
  const stats = [
    {
      label: "Devices",
      value: farm?.devices.length ?? 0,
      hint: "On this farm",
    },
    { label: "Active now", value: activeCount, hint: "Live device state" },
    { label: "Online", value: onlineCount, hint: "Reporting status" },
    {
      label: "Flow paths",
      value: farm?.layout.connections.length ?? 0,
      hint: "Configured routes",
    },
  ];

  return (
    <div id="dashboard" className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
          User dashboard
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Farm overview
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Published layout and live device status for {farmName}.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
              {stat.label}
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
              {stat.value}
            </p>
            <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
              {stat.hint}
            </p>
          </div>
        ))}
      </div>

      <section
        id="farm-layout"
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div
          id="live-status"
          className="mb-5 flex flex-wrap items-center justify-between gap-3"
        >
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {farmName}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Published farm layout with live device status.
            </p>
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              statusConnection === "connected"
                ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {statusLabel}
          </span>
        </div>
        {farm ? (
          <FarmLayoutViewer
            layout={farm.layout}
            devices={farm.devices}
            statuses={statuses}
          />
        ) : (
          <p className="rounded-xl bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
            No published layout is available for this farm.
          </p>
        )}
      </section>
    </div>
  );
}
