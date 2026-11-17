"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { PublishedFarm } from "@/lib/published-layout";

type LayoutResponse = {
  email?: string;
  farms?: PublishedFarm[];
  error?: string;
};

const FarmLayoutViewer = dynamic(
  () => import("@/components/farm-layout/FarmLayoutViewer"),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 w-full animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />
    ),
  },
);

const INPUT_CLASS =
  "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

function formatUpdatedAt(value: string | null): string {
  if (!value) {
    return "";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return ` · Updated ${date.toISOString().slice(0, 19).replace("T", " ")} UTC`;
}

export function PublishedLayoutPanel({
  initialEmail,
  initialFarms,
  canViewOtherEmails,
}: {
  initialEmail: string;
  initialFarms: PublishedFarm[];
  canViewOtherEmails: boolean;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [farms, setFarms] = useState<PublishedFarm[]>(initialFarms);
  const [selectedFarmId, setSelectedFarmId] = useState(
    initialFarms[0]?.id ?? "",
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadLayout = useCallback(async (targetEmail: string) => {
    if (!targetEmail) {
      setError("No email is available for this session.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/layout?email=${encodeURIComponent(targetEmail)}`,
        { credentials: "same-origin" },
      );
      const data = (await response.json()) as LayoutResponse;

      if (!response.ok) {
        setError(
          response.status === 401
            ? "Your session expired. Please sign in again."
            : (data.error ?? "Unable to load published layout"),
        );
        setFarms([]);
        return;
      }

      const loadedFarms = data.farms ?? [];
      setFarms(loadedFarms);
      setSelectedFarmId((current) =>
        loadedFarms.some((farm) => farm.id === current)
          ? current
          : (loadedFarms[0]?.id ?? ""),
      );
    } catch {
      setError("Network error while loading published layout");
      setFarms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") {
        void loadLayout(email);
      }
    };

    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [email, loadLayout]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void loadLayout(email.trim());
  }

  const selectedFarm = farms.find((farm) => farm.id === selectedFarmId);

  return (
    <section className="w-full max-w-5xl rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-white">
            Published layout
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Saved farm layout for the selected email.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex w-full max-w-md gap-2">
          <div className="min-w-0 flex-1">
            <label
              htmlFor="layout-email"
              className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300"
            >
              Layout email
            </label>
            <input
              id="layout-email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              readOnly={!canViewOtherEmails}
              className={INPUT_CLASS}
              placeholder="name@example.com"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="mt-5 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Loading" : "Show"}
          </button>
        </form>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
          {error}
        </p>
      ) : null}

      {!error && farms.length === 0 ? (
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600 dark:bg-slate-950 dark:text-slate-300">
          No saved layout found for this email.
        </p>
      ) : null}

      {farms.length > 1 ? (
        <div className="mt-5">
          <label
            htmlFor="layout-farm"
            className="mb-1 block text-xs font-medium text-slate-600 dark:text-slate-300"
          >
            Farm
          </label>
          <select
            id="layout-farm"
            value={selectedFarmId}
            onChange={(event) => setSelectedFarmId(event.target.value)}
            className={INPUT_CLASS}
          >
            {farms.map((farm) => (
              <option key={farm.id} value={farm.id}>
                {farm.name} — {farm.location}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      {selectedFarm ? (
        <div className="mt-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-sm text-slate-500 dark:text-slate-400">
            <span className="font-medium text-slate-700 dark:text-slate-200">
              {selectedFarm.name}
            </span>
            <span>
              Version {selectedFarm.layout.version}
              {formatUpdatedAt(selectedFarm.layout.updatedAt)}
            </span>
          </div>
          <FarmLayoutViewer
            layout={selectedFarm.layout}
            devices={selectedFarm.devices}
          />
        </div>
      ) : null}
    </section>
  );
}
