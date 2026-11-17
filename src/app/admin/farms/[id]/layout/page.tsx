import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { isObjectId } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

export const instant = false;

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

  const farm = await prisma.farm.findUnique({
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
  });

  if (!farm) {
    notFound();
  }

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
            {farm.devices.length}
          </p>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Layout canvas
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Arrange this farm’s devices on the layout grid.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            Draft
          </span>
        </div>

        <div className="mt-6 min-h-[420px] rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 dark:border-slate-700 dark:bg-slate-950/40">
          <div className="flex min-h-[370px] items-center justify-center">
            <div className="text-center">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                className="mx-auto h-10 w-10 text-slate-400 dark:text-slate-500"
              >
                <path
                  d="M4 4h6v6H4V4ZM14 4h6v6h-6V4ZM4 14h6v6H4v-6ZM14 14h6v6h-6v-6Z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
              <p className="mt-4 font-medium text-slate-700 dark:text-slate-200">
                Layout editor is ready
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Device placement and saving can be added here.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Devices for this farm
          </h3>
          {farm.devices.length ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {farm.devices.map((device) => (
                <span
                  key={device.id}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  {device.name} · {device.type}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">
              No devices are assigned to this farm yet.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
