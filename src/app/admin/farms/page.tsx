import { connection } from "next/server";
import {
  AdminFarmsManager,
  type AdminFarmRow,
  type AdminOwnerOption,
} from "@/components/AdminFarmsManager";
import { prisma } from "@/lib/prisma";

export const instant = false;

export default async function AdminFarmsPage() {
  await connection();

  const [farms, owners] = await Promise.all([
    prisma.farm.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        location: true,
        ownerId: true,
        createdAt: true,
        owner: { select: { name: true, email: true } },
        _count: { select: { devices: true } },
      },
    }),
    prisma.user.findMany({
      orderBy: [{ name: "asc" }, { email: "asc" }],
      select: { id: true, name: true, email: true },
    }),
  ]);

  const rows: AdminFarmRow[] = farms.map((farm) => ({
    id: farm.id,
    name: farm.name,
    location: farm.location,
    ownerId: farm.ownerId,
    ownerName: farm.owner.name ?? "Unnamed",
    ownerEmail: farm.owner.email,
    deviceCount: farm._count.devices,
    createdAt: farm.createdAt.toISOString(),
  }));

  const ownerOptions: AdminOwnerOption[] = owners.map((owner) => ({
    id: owner.id,
    label: `${owner.name ?? "Unnamed"} (${owner.email})`,
  }));

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
          Management
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Farm management
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Manage farms, ownership, and registered locations.
        </p>
      </header>

      <AdminFarmsManager farms={rows} owners={ownerOptions} />
    </div>
  );
}
