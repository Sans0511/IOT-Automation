import { connection } from "next/server";
import { AdminUsersManager, type AdminUserRow } from "@/components/AdminUsersManager";
import { generateTemporaryPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

export const instant = false;

export default async function AdminUsersPage() {
  await connection();

  const temporaryPassword = generateTemporaryPassword();
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      createdAt: true,
      _count: { select: { farms: true } },
    },
  });

  const rows: AdminUserRow[] = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt.toISOString(),
    farmCount: user._count.farms,
  }));

  return (
    <div className="space-y-8">
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
          Management
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 dark:text-white">
          User management
        </h1>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Manage platform administrators and farm owners.
        </p>
      </header>

      <AdminUsersManager
        users={rows}
        temporaryPassword={temporaryPassword}
      />
    </div>
  );
}
