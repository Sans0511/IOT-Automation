import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import FarmLayoutEditor from "@/components/farm-layout/FarmLayoutEditor";
import {
  isObjectId,
  isRecord,
} from "@/lib/api-helpers";
import {
  createDefaultFarmLayout,
  derivePresetDevices,
  FARM_CANVAS_HEIGHT,
  FARM_CANVAS_WIDTH,
  FARM_LAYOUT_BACKGROUND,
  isFarmDevicePresetKey,
  parseFarmBackgroundItems,
  parseFarmConnections,
  type FarmLayoutData,
  type FarmLayoutDevice,
  type FarmLayoutPlacement,
} from "@/lib/farm-layout";
import { prisma } from "@/lib/prisma";

export const instant = false;

function clamp(value: number, max: number): number {
  return Math.min(max, Math.max(0, Math.round(value)));
}

function readPlacements(
  value: unknown,
  allowedDeviceIds: Set<string>,
): FarmLayoutPlacement[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  const placements: FarmLayoutPlacement[] = [];

  for (const entry of value) {
    if (!isRecord(entry)) {
      continue;
    }

    const { deviceId, x, y, rotation, label, presetKey } = entry;
    const isPreset = isFarmDevicePresetKey(presetKey);

    if (
      typeof deviceId !== "string" ||
      !isObjectId(deviceId) ||
      (!allowedDeviceIds.has(deviceId) && !isPreset) ||
      seen.has(deviceId) ||
      typeof x !== "number" ||
      !Number.isFinite(x) ||
      typeof y !== "number" ||
      !Number.isFinite(y)
    ) {
      continue;
    }

    const normalizedRotation =
      typeof rotation === "number" && Number.isFinite(rotation)
        ? ((Math.round(rotation) % 360) + 360) % 360
        : 0;

    seen.add(deviceId);
    placements.push({
      deviceId,
      x: clamp(x, FARM_CANVAS_WIDTH),
      y: clamp(y, FARM_CANVAS_HEIGHT),
      rotation: normalizedRotation,
      label: typeof label === "string" && label.trim() ? label : null,
      ...(isPreset ? { presetKey } : {}),
    });
  }

  return placements;
}

export default async function FarmLayoutPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await connection();

  const { id } = await params;

  if (!isObjectId(id)) {
    notFound();
  }

  const [farm, savedLayout] = await Promise.all([
    prisma.farm.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        location: true,
        owner: { select: { name: true, email: true } },
        devices: {
          orderBy: { name: "asc" },
          select: { id: true, name: true, type: true },
        },
      },
    }),
    prisma.farmLayout.findUnique({ where: { farmId: id } }),
  ]);

  if (!farm) {
    notFound();
  }

  const farmDevices: FarmLayoutDevice[] = farm.devices.map((device) => ({
    id: device.id,
    name: device.name,
    type: device.type,
  }));
  const farmDeviceIds = new Set(farmDevices.map((device) => device.id));
  const placements = savedLayout
    ? readPlacements(savedLayout.placements, farmDeviceIds)
    : [];
  const devices = [...farmDevices, ...derivePresetDevices(placements, farmDevices)];
  const connections = savedLayout
    ? parseFarmConnections(savedLayout.connections) ?? []
    : [];

  const initialLayout: FarmLayoutData = savedLayout
    ? {
        id: savedLayout.id,
        farmId: savedLayout.farmId,
        width: savedLayout.width,
        height: savedLayout.height,
        backgroundKey: savedLayout.backgroundKey || FARM_LAYOUT_BACKGROUND,
        placements,
        backgroundItems:
          parseFarmBackgroundItems(savedLayout.backgroundItems) ?? [],
        connections,
        version: savedLayout.version,
        updatedAt: savedLayout.updatedAt.toISOString(),
      }
    : createDefaultFarmLayout(id);

  return (
    <div className="space-y-8">
      <header>
        <Link
          href="/admin/farms"
          className="text-sm font-medium text-emerald-600 hover:text-emerald-500 dark:text-emerald-400"
        >
          ← Back to farms
        </Link>
        <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
          Farm layout
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Create Layout
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          {farm.name} · {farm.location}
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Farm</p>
          <p className="mt-2 font-medium text-slate-900 dark:text-white">
            {farm.name}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Owner</p>
          <p className="mt-2 font-medium text-slate-900 dark:text-white">
            {farm.owner.name ?? "Unnamed"}
          </p>
          <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
            {farm.owner.email}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <p className="text-sm text-slate-500 dark:text-slate-400">Devices</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900 dark:text-white">
            {devices.length}
          </p>
        </div>
      </section>

      <FarmLayoutEditor
        farmId={farm.id}
        devices={devices}
        initialLayout={initialLayout}
      />
    </div>
  );
}
