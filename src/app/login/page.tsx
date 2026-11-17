"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

type LoginResponse = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string | null;
    email: string;
    role: "ADMIN" | "USER";
  };
};

type ErrorResponse = {
  error: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data: LoginResponse | ErrorResponse = await response.json();

      if (!response.ok) {
        setError("error" in data ? data.error : "Unable to sign in");
        return;
      }

      if (!("accessToken" in data)) {
        setError("Unexpected response from the server");
        return;
      }

      router.replace("/");
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <section className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-900 p-12 text-white lg:flex">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,white_1px,transparent_0)] [background-size:24px_24px]" />

        <div className="relative flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              className="h-6 w-6"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 21c0-6 3-10 9-12-1 7-4 11-9 12Zm0 0C12 14 9 10 3 8c1 7 4 11 9 13Z"
              />
              <path strokeLinecap="round" d="M12 21v-8" />
            </svg>
          </span>
          <div>
            <p className="text-lg font-semibold tracking-tight">IOT-Automation</p>
            <p className="text-sm text-emerald-100">Farm Digital Twin</p>
          </div>
        </div>

        <div className="relative max-w-lg">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            Every field, every device, one live view.
          </h2>
          <p className="mt-5 text-base leading-7 text-emerald-100">
            Monitor soil conditions, device health, and sensor telemetry from a
            single control center built for modern farms.
          </p>
          <div className="mt-10 grid grid-cols-3 gap-4 text-sm">
            <div className="rounded-xl bg-white/10 p-4 ring-1 ring-white/15">
              <p className="text-2xl font-semibold">24/7</p>
              <p className="mt-1 text-emerald-100">Live monitoring</p>
            </div>
            <div className="rounded-xl bg-white/10 p-4 ring-1 ring-white/15">
              <p className="text-2xl font-semibold">Real-time</p>
              <p className="mt-1 text-emerald-100">Sensor data</p>
            </div>
            <div className="rounded-xl bg-white/10 p-4 ring-1 ring-white/15">
              <p className="text-2xl font-semibold">Secure</p>
              <p className="mt-1 text-emerald-100">Role-based access</p>
            </div>
          </div>
        </div>

        <p className="relative text-sm text-emerald-200">
          © 2026 IOT-Automation. All rights reserved.
        </p>
      </section>

      <section className="flex flex-1 items-center justify-center px-6 py-12 sm:px-10">
        <div className="w-full max-w-md">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-white">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                className="h-5 w-5"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 21c0-6 3-10 9-12-1 7-4 11-9 12Zm0 0C12 14 9 10 3 8c1 7 4 11 9 13Z"
                />
                <path strokeLinecap="round" d="M12 21v-8" />
              </svg>
            </span>
            <span className="text-lg font-semibold text-slate-900 dark:text-white">
              IOT-Automation
            </span>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-xl shadow-slate-200/50 dark:border-slate-800 dark:bg-slate-900 dark:shadow-none sm:p-10">
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-white">
              Welcome back
            </h1>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Sign in to access your farm control center.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              {error && (
                <div
                  role="alert"
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300"
                >
                  {error}
                </div>
              )}

              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                >
                  Email address
                </label>
                <div className="relative mt-2">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="h-5 w-5"
                      aria-hidden="true"
                    >
                      <rect x="3" y="5" width="18" height="14" rx="2" />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m3 7 9 6 9-6"
                      />
                    </svg>
                  </span>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="operator@farm.io"
                    className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-600"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between">
                  <label
                    htmlFor="password"
                    className="block text-sm font-medium text-slate-700 dark:text-slate-300"
                  >
                    Password
                  </label>
                  <span className="text-xs text-slate-400">
                    Contact your admin if forgotten
                  </span>
                </div>
                <div className="relative mt-2">
                  <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="h-5 w-5"
                      aria-hidden="true"
                    >
                      <rect x="4" y="10" width="16" height="11" rx="2" />
                      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                    </svg>
                  </span>
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    className="block w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-11 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-600"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
                  >
                    {showPassword ? (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        className="h-5 w-5"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.2A9.8 9.8 0 0 1 12 5c5 0 9 4.5 10 7-1 1.7-2.6 3.4-4.7 4.6M6.2 6.3C4.4 7.5 3 9.3 2 12c1 2.5 5 7 10 7 1.4 0 2.7-.3 3.8-.8"
                        />
                      </svg>
                    ) : (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        className="h-5 w-5"
                        aria-hidden="true"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
                        />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700 focus:outline-none focus:ring-4 focus:ring-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSubmitting && (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  >
                    <circle
                      cx="12"
                      cy="12"
                      r="9"
                      stroke="currentColor"
                      strokeWidth="3"
                      opacity="0.3"
                    />
                    <path
                      fill="currentColor"
                      d="M21 12a9 9 0 0 0-9-9v3a6 6 0 0 1 6 6h3Z"
                    />
                  </svg>
                )}
                {isSubmitting ? "Signing in..." : "Sign in"}
              </button>
            </form>

            <p className="mt-8 text-center text-xs text-slate-400">
              Secure access for authorized operators
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}
