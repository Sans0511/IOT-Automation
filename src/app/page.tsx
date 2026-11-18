import { cookies } from "next/headers";
import { connection } from "next/server";
import { PublishedLayoutPanel } from "@/components/PublishedLayoutPanel";
import { UserSidebar } from "@/components/UserSidebar";
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
  const farm = publishedLayouts?.farms[0] ?? null;
  const farmName = farm?.name ?? "No published farm";

  return (
    <main className="flex min-h-screen flex-1 bg-zinc-50 font-sans dark:bg-black">
      <div className="flex w-full flex-col lg:flex-row">
        <UserSidebar role={user?.role ?? "USER"} farmName={farmName} />
        <div className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:py-10">
          <PublishedLayoutPanel key={farm?.id ?? "none"} farm={farm} />
        </div>
      </div>
    </main>
  );
}
