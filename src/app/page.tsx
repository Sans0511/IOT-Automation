import { cookies } from "next/headers";
import Link from "next/link";
import { connection } from "next/server";
import { PublishedLayoutPanel } from "@/components/PublishedLayoutPanel";
import { TelemetryMonitor } from "@/components/TelemetryMonitor";
import { verifyAccessToken } from "@/lib/api-auth";
import { getPublishedLayoutsByEmail } from "@/lib/published-layout";

export const instant = false;

export default async function Home() {
  await connection();
  const cookieStore = await cookies();
  const user = verifyAccessToken(cookieStore.get("access_token")?.value ?? "");
  const publishedLayouts = user
    ? await getPublishedLayoutsByEmail(user.email)
    : null;

  return (
    <main className="flex min-h-screen flex-1 flex-col items-center justify-center gap-8 bg-zinc-50 p-6 font-sans dark:bg-black">
      <div className="flex w-full max-w-5xl flex-wrap items-center justify-between gap-4">
        <h1 className="text-4xl font-semibold tracking-tight text-black dark:text-zinc-50">
          IOT-Automation
        </h1>
        {user?.role === "ADMIN" ? (
          <Link
            href="/admin"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Admin dashboard
          </Link>
        ) : null}
      </div>
      <TelemetryMonitor />
      <PublishedLayoutPanel
        initialEmail={user?.email ?? ""}
        initialFarms={publishedLayouts?.farms ?? []}
        canViewOtherEmails={user?.role === "ADMIN"}
      />
    </main>
  );
}
