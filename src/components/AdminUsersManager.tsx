"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

type UserRole = "ADMIN" | "USER";

export interface AdminUserRow {
  id: string;
  name: string | null;
  email: string;
  role: UserRole;
  createdAt: string;
  farmCount: number;
}

const FIELD_CLASS =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white";

const DATE_FORMAT = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
});

const PASSWORD_SETS = [
  "ABCDEFGHJKLMNPQRSTUVWXYZ",
  "abcdefghijkmnopqrstuvwxyz",
  "23456789",
  "!@#$%^&*_-+=",
] as const;

function createBrowserTemporaryPassword(length = 16): string {
  const values = new Uint32Array(length);
  window.crypto.getRandomValues(values);
  const characters = PASSWORD_SETS.map(
    (set, index) => set[values[index] % set.length],
  );
  const allCharacters = PASSWORD_SETS.join("");

  for (let index = characters.length; index < length; index += 1) {
    characters.push(allCharacters[values[index] % allCharacters.length]);
  }

  for (let index = characters.length - 1; index > 0; index -= 1) {
    const swapIndex = values[index] % (index + 1);
    [characters[index], characters[swapIndex]] = [
      characters[swapIndex],
      characters[index],
    ];
  }

  return characters.join("");
}

export function AdminUsersManager({
  users,
  temporaryPassword,
}: {
  users: AdminUserRow[];
  temporaryPassword: string;
}) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState(temporaryPassword);
  const [showPassword, setShowPassword] = useState(false);
  const [role, setRole] = useState<UserRole>("USER");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function resetForm() {
    setEditingId(null);
    setName("");
    setEmail("");
    setPassword(createBrowserTemporaryPassword());
    setShowPassword(false);
    setRole("USER");
  }

  function startEdit(user: AdminUserRow) {
    setEditingId(user.id);
    setName(user.name ?? "");
    setEmail(user.email);
    setPassword("");
    setShowPassword(false);
    setRole(user.role);
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
        ? `/api/admin/users/${editingId}`
        : "/api/auth/register";
      const payload = editingId
        ? { name, email, role }
        : { name, email, password, role };
      const response = await fetch(endpoint, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Unable to save user");
        return;
      }

      setSuccess(editingId ? "User updated successfully." : "User created successfully.");
      resetForm();
      router.refresh();
    } catch {
      setError("Network error while saving user");
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(user: AdminUserRow) {
    setError(null);
    setSuccess(null);

    if (!window.confirm(`Delete ${user.email}? This cannot be undone.`)) {
      return;
    }

    setBusy(true);

    try {
      const response = await fetch(`/api/admin/users/${user.id}`, {
        method: "DELETE",
        credentials: "same-origin",
      });
      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Unable to delete user");
        return;
      }

      setSuccess("User deleted successfully.");
      if (editingId === user.id) {
        resetForm();
      }
      router.refresh();
    } catch {
      setError("Network error while deleting user");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
            Users
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Create, update, and remove admin accounts and farm users.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
              <tr>
                <th className="px-6 py-3">Name</th>
                <th className="px-6 py-3">Email</th>
                <th className="px-6 py-3">Role</th>
                <th className="px-6 py-3">Farms</th>
                <th className="px-6 py-3">Created</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {users.length ? (
                users.map((user) => (
                  <tr key={user.id}>
                    <td className="px-6 py-3 font-medium text-slate-900 dark:text-white">
                      {user.name ?? "Unnamed"}
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                      {user.email}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                          user.role === "ADMIN"
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                            : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                        }`}
                      >
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-3 text-slate-600 dark:text-slate-300">
                      {user.farmCount}
                    </td>
                    <td className="whitespace-nowrap px-6 py-3 text-slate-500 dark:text-slate-400">
                      {DATE_FORMAT.format(new Date(user.createdAt))}
                    </td>
                    <td className="px-6 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(user)}
                          disabled={busy}
                          className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDelete(user)}
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
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
          {editingId ? "Edit user" : "Create user"}
        </h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {editingId
            ? "Update account details and access level."
            : "Add a new admin or farm user."}
        </p>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label
              htmlFor="admin-user-name"
              className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Name
            </label>
            <input
              id="admin-user-name"
              required
              value={name}
              onChange={(event) => setName(event.target.value)}
              className={FIELD_CLASS}
            />
          </div>

          <div>
            <label
              htmlFor="admin-user-email"
              className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Email
            </label>
            <input
              id="admin-user-email"
              required
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className={FIELD_CLASS}
            />
          </div>

          {!editingId ? (
            <div>
              <label
                htmlFor="admin-user-password"
                className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200"
              >
                Temporary password
              </label>
              <div className="relative">
                <input
                  id="admin-user-password"
                  required
                  readOnly
                  minLength={8}
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  value={password}
                  className={`${FIELD_CLASS} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-lg text-slate-500 transition hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-100"
                >
                  {showPassword ? (
                    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                      <path
                        d="M3 3l18 18M10.6 6.2A9.7 9.7 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.3 3M6.4 7.5C3.9 9.2 2.5 12 2.5 12s3.5 6 9.5 6c1.2 0 2.3-.2 3.3-.6M9.9 9.9a3 3 0 0 0 4.2 4.2"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                      <path
                        d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <circle
                        cx="12"
                        cy="12"
                        r="2.8"
                        stroke="currentColor"
                        strokeWidth="1.8"
                      />
                    </svg>
                  )}
                </button>
              </div>
              <p className="mt-1.5 text-xs text-slate-400 dark:text-slate-500">
                Generated automatically. Copy it before creating the user.
              </p>
            </div>
          ) : null}

          <div>
            <label
              htmlFor="admin-user-role"
              className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200"
            >
              Role
            </label>
            <select
              id="admin-user-role"
              value={role}
              onChange={(event) => setRole(event.target.value as UserRole)}
              className={FIELD_CLASS}
            >
              <option value="USER">User</option>
              <option value="ADMIN">Admin</option>
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
              disabled={busy}
              className="flex-1 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {busy
                ? "Saving..."
                : editingId
                  ? "Update user"
                  : "Create user"}
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
