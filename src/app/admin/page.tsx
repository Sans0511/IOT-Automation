import { connection } from "next/server";
import { Pagination } from "@/components/Pagination";
import { prisma } from "@/lib/prisma";

export const instant = false;

const PAGE_SIZE = 10;
const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

function formatDate(value: Date): string {
  return DATE_FORMAT.format(value);
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string | string[] }>;
}) {
  await connection();

  const { page: pageParam } = await searchParams;
  const parsedPage =
    typeof pageParam === "string" ? Number.parseInt(pageParam, 10) : Number.NaN;
  const requestedPage =
    Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;

  const [userCount, adminCount, farmCount, deviceCount, deviceTypes] =
    await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.farm.count(),
      prisma.device.count(),
      prisma.device.groupBy({ by: ["type"], _count: { _all: true } }),
    ]);

  const totalPages = Math.max(1, Math.ceil(farmCount / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  const farms = await prisma.farm.findMany({
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      location: true,
      createdAt: true,
      owner: { select: { id: true, name: true, email: true } },
      _count: { select: { devices: true } },
    },
  });

  const stats = [
    { label: "Total users", value: userCount, hint: `${adminCount} admins` },
    { label: "Farms", value: farmCount, hint: "Registered farms" },
    { label: "Devices", value: deviceCount, hint: "Provisioned devices" },
    {
      label: "Device types",
      value: deviceTypes.length,
      hint: "Active categories",
    },
  ];

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
          Administration
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
          Admin dashboard
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Platform overview with all registered farms.
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

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              All farms
            </h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Registered farms with owner and device counts.
            </p>
          </div>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {farmCount} total
          </span>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3">Farm</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Owner</th>
                <th className="px-4 py-3">Devices</th>
                <th className="px-4 py-3">Created</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {farms.length ? (
                farms.map((farm) => (
                  <tr key={farm.id}>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      {farm.name}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {farm.location}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      <span className="block">{farm.owner.name ?? "Unnamed"}</span>
                      <span className="block text-xs text-slate-400 dark:text-slate-500">
                        {farm.owner.email}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {farm._count.devices}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-500 dark:text-slate-400">
                      {formatDate(farm.createdAt)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-slate-500 dark:text-slate-400"
                  >
                    No farms found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={page} totalPages={totalPages} basePath="/admin" />
      </section>
    </div>
  );
}
