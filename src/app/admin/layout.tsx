import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { AdminSidebar } from "@/components/AdminSidebar";
import { verifyAccessToken } from "@/lib/api-auth";

export const instant = false;

export const metadata: Metadata = {
  title: "Admin dashboard | IOT-Automation",
  description: "Administrative overview of users, farms, and devices",
};

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  await connection();
  const cookieStore = await cookies();
  const user = verifyAccessToken(cookieStore.get("access_token")?.value ?? "");

  if (!user) {
    redirect("/login");
  }

  if (user.role !== "ADMIN") {
    redirect("/");
  }

  return (
    <main className="flex min-h-screen flex-1 bg-zinc-50 font-sans dark:bg-black">
      <div className="flex w-full flex-col lg:flex-row">
        <AdminSidebar />
        <div className="min-w-0 flex-1 px-5 py-8 sm:px-8 lg:py-10">{children}</div>
      </div>
    </main>
  );
}
