"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import { DeviceCommandDialog } from "@/components/DeviceCommandDialog";
import { DeviceControls } from "@/components/DeviceControls";
import {
  getToggleDeviceCommand,
  isControllableDeviceType,
  type DeviceCommand,
  type DeviceCommandTarget,
  type PendingDeviceCommand,
} from "@/lib/device-control";
import type { FarmLayoutDevice } from "@/lib/farm-layout";
import type { PublishedFarm } from "@/lib/published-layout";
import {
  getDeviceRuntimeStatus,
  parseDeviceMessageEnvelope,
  resolveDeviceRuntimeStatus,
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
  const [telemetry, setTelemetry] = useState<StatusMap>({});
  const [statusConnection, setStatusConnection] =
    useState<StatusConnectionState>("connecting");
  const [pendingCommand, setPendingCommand] =
    useState<PendingDeviceCommand | null>(null);
  const [commandBusy, setCommandBusy] = useState(false);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [commandNotice, setCommandNotice] = useState<string | null>(null);

  const previousFarmIdRef = useRef(farmId);

  useEffect(() => {
    if (previousFarmIdRef.current === farmId) {
      return;
    }

    previousFarmIdRef.current = farmId;
    setStatuses(farm?.statuses ?? {});
    setTelemetry({});
  }, [farmId, farm?.statuses]);

  useEffect(() => {
    if (!farmId) {
      return;
    }

    const stream = new EventSource(
      `/api/realtime/stream?farmId=${encodeURIComponent(farmId)}`,
    );

    stream.onopen = () => {
      setStatusConnection("connected");
    };

    stream.onerror = () => {
      setStatusConnection("reconnecting");
    };

    const handleEvent = (event: Event) => {
      if (!(event instanceof MessageEvent)) {
        return;
      }

      try {
        const envelope = parseDeviceMessageEnvelope(event.data);

        if (!envelope || envelope.farmId !== farmId) {
          return;
        }

        const update = (current: StatusMap) => ({
          ...current,
          [envelope.deviceId]: envelope,
        });

        if (envelope.kind === "status") {
          setStatuses(update);
        } else {
          setTelemetry(update);
        }
      } catch {
        return;
      }
    };

    stream.addEventListener("status", handleEvent);
    stream.addEventListener("telemetry", handleEvent);

    return () => {
      stream.removeEventListener("status", handleEvent);
      stream.removeEventListener("telemetry", handleEvent);
      stream.close();
    };
  }, [farmId]);

  const runtimeByDevice = useMemo(
    () =>
      new Map(
        (devices ?? []).map((device) => [
          device.id,
          resolveDeviceRuntimeStatus(
            device.type,
            statuses[device.id],
            telemetry[device.id],
          ),
        ]),
      ),
    [devices, statuses, telemetry],
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

  function requestCommand(
    device: DeviceCommandTarget,
    command: DeviceCommand,
  ) {
    if (commandBusy) {
      return;
    }

    setCommandNotice(null);
    setCommandError(null);
    setPendingCommand({ device, command });
  }

  function handleDeviceDoubleClick(device: FarmLayoutDevice) {
    if (!isControllableDeviceType(device.type)) {
      return;
    }

    const runtime = getDeviceRuntimeStatus(statuses[device.id], device.type);
    requestCommand(device, getToggleDeviceCommand(runtime));
  }

  async function confirmCommand() {
    if (!pendingCommand) {
      return;
    }

    const target = pendingCommand;
    setCommandBusy(true);
    setCommandError(null);

    try {
      const response = await fetch(
        `/api/devices/${encodeURIComponent(target.device.id)}/command`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ command: target.command }),
        },
      );
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(data.error ?? "Unable to send command");
      }

      setCommandNotice(
        `${target.device.name} ${target.command} command sent.`,
      );
      setPendingCommand(null);
    } catch (error) {
      setCommandError(
        error instanceof Error ? error.message : "Unable to send command",
      );
    } finally {
      setCommandBusy(false);
    }
  }

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

      <DeviceControls
        devices={farm?.devices ?? []}
        statuses={statuses}
        notice={commandNotice}
        busy={commandBusy}
        onRequest={requestCommand}
      />

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {farmName}
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Published farm layout with live device status. Double-click a pump
              or valve to toggle it.
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
            telemetry={telemetry}
            onDeviceDoubleClick={handleDeviceDoubleClick}
          />
        ) : (
          <p className="rounded-xl bg-slate-50 px-4 py-6 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
            No published layout is available for this farm.
          </p>
        )}
      </section>

      <DeviceCommandDialog
        pending={pendingCommand}
        busy={commandBusy}
        error={commandError}
        onCancel={() => {
          setPendingCommand(null);
          setCommandError(null);
        }}
        onConfirm={() => void confirmCommand()}
      />
    </div>
  );
}
