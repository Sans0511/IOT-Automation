import type { ReactNode } from "react";

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    href: "#dashboard",
    label: "Overview",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="M4 13h6V4H4v9Zm0 7h6v-5H4v5Zm10 0h6v-9h-6v9Zm0-16v5h6V4h-6Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "#farm-layout",
    label: "Farm layout",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="M4 20V9l8-5 8 5v11M9 20v-6h6v6M4 11h16"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    href: "#live-status",
    label: "Live status",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
        <path
          d="M5 13.5a9 9 0 0 1 14 0M8 16a5 5 0 0 1 8 0M12 19h.01"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    ),
  },
];

export function UserSidebar({
  role,
  farmName,
}: {
  role: string;
  farmName: string;
}) {
  return (
    <aside className="border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
      <div className="px-5 py-5 lg:sticky lg:top-0 lg:px-6 lg:py-8">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600 dark:text-emerald-400">
              IOT-Automation
            </p>
            <p className="mt-1 text-sm font-medium text-slate-900 dark:text-white">
              User dashboard
            </p>
          </div>
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
            {role}
          </span>
        </div>

        <div className="mt-3 hidden rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 lg:block dark:border-slate-800 dark:bg-slate-950">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Active farm
          </p>
          <p className="mt-0.5 truncate text-sm font-medium text-slate-700 dark:text-slate-200">
            {farmName}
          </p>
        </div>

        <nav className="mt-8 hidden lg:block" aria-label="User navigation">
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Workspace
          </p>
          <div className="mt-3 space-y-1">
            {NAV_ITEMS.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
              >
                {item.icon}
                {item.label}
              </a>
            ))}
          </div>
        </nav>
      </div>

      <nav
        className="flex gap-2 overflow-x-auto border-t border-slate-200 px-4 py-3 dark:border-slate-800 lg:hidden"
        aria-label="User navigation"
      >
        {NAV_ITEMS.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className="flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {item.icon}
            {item.label}
          </a>
        ))}
      </nav>
    </aside>
  );
}
