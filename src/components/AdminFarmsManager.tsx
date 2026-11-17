"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

export interface AdminFarmRow {
  id: string;
  name: string;
  location: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  deviceCount: number;
  createdAt: string;
}

export interface AdminOwnerOption {
  id: string;
  label: string;
}

const FIELD_CLASS =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

export function AdminFarmsManager({
  farms,
  owners,
}: {
  farms: AdminFarmRow[];
  owners: AdminOwnerOption[];
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");
  const [ownerId, setOwnerId] = useState(owners[0]?.id ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function resetForm() {
    setEditingId(null);
    setName("");
    setLocation("");
    setOwnerId(owners[0]?.id ?? "");
  }

  function startEdit(farm: AdminFarmRow) {
    setEditingId(farm.id);
    setName(farm.name);
    setLocation(farm.location);
    setOwnerId(farm.ownerId);
    setError(null);
    setSuccess(null);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    setBusy(true);

    try {
      const endpoint = editingId
        ? `/api/admin/farms/${editingId}`
        : "/api/admin/farms";
      const response = await fetch(endpoint, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ name, location, ownerId }),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Unable to save farm");
        return;
      }

      setSuccess(editingId ? "Farm updated successfully." : "Farm created successfully.");
      resetForm();
      router.refresh();
    } catch {
      setError("Network error while saving farm");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(farm: AdminFarmRow) {
    setError(null);
    setSuccess(null);

    if (!window.confirm(`Delete ${farm.name} and its devices? This cannot be undone.`)) {
      return;
    }

    setBusy(true);

    try {
      const response = await fetch(`/api/admin/farms/${farm.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Unable to delete farm");
        return;
      }

      setSuccess("Farm deleted successfully.");
      if (editingId === farm.id) {
        resetForm();
      }
      router.refresh();
    } catch {
      setError("Network error while deleting farm");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Farms
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Create farms, change ownership, and remove farms with their devices.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-6 py-3">Farm</th>
                <th className="px-6 py-3">Location</th>
                <th className="px-6 py-3">Owner</th>
                <th className="px-6 py-3">Devices</th>
                <th className="px-6 py-3">Created</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {farms.length ? (
                farms.map((farm) => (
                  <tr key={farm.id}>
                    <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">
                      {farm.name}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                      {farm.location}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                      <span className="block">{farm.ownerName}</span>
                      <span className="block text-xs text-slate-400 dark:text-slate-500">
                        {farm.ownerEmail}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                      {farm.deviceCount}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3 text-slate-500 dark:text-slate-400">
                      {DATE_FORMAT.format(new Date(farm.createdAt))}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex justify-end gap-2">
                        <Link
                          href={`/admin/farms/${farm.id}/layout`}
                          className="rounded-lg border border-emerald-200 px-3 py-1.5 text-xs font-medium text-emerald-700 transition hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-950/40"
                        >
                          Create Layout
                        </Link>
                        <button
                          type="button"
                          onClick={() => startEdit(farm)}
                          disabled={busy}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(farm)}
                          disabled={busy}
                          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={6}
                    className="px-6 py-8 text-center text-slate-500 dark:text-slate-400"
                  >
                    No farms found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {editingId ? "Edit farm" : "Create farm"}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {editingId
            ? "Update farm details and owner."
            : "Register a new farm and assign an owner."}
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="admin-farm-name"
              className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Farm name
            </label>
            <input
              id="admin-farm-name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={FIELD_CLASS}
            />
          </div>

          <div>
            <label
              htmlFor="admin-farm-location"
              className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Location
            </label>
            <input
              id="admin-farm-location"
              required
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              className={FIELD_CLASS}
            />
          </div>

          <div>
            <label
              htmlFor="admin-farm-owner"
              className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Owner
            </label>
            <select
              id="admin-farm-owner"
              required
              value={ownerId}
              onChange={(event) => setOwnerId(event.target.value)}
              className={FIELD_CLASS}
            >
              {owners.length ? (
                owners.map((owner) => (
                  <option key={owner.id} value={owner.id}>
                    {owner.label}
                  </option>
                ))
              ) : (
                <option value="">No users available</option>
              )}
            </select>
          </div>

          {error ? (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950/40 dark:text-red-300">
              {error}
            </p>
          ) : null}

          {success ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              {success}
            </p>
          ) : null}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={busy || !ownerId}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy ? "Saving..." : editingId ? "Update farm" : "Create farm"}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
            ) : null}
          </div>
        </form>
      </section>
    </div>
  );
}
