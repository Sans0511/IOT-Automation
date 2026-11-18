import type { FarmLayoutData, FarmLayoutDevice } from "@/lib/farm-layout";

export type FarmLayoutPayload = Pick<
  FarmLayoutData,
  | "version"
  | "backgroundKey"
  | "width"
  | "height"
  | "placements"
  | "backgroundItems"
  | "connections"
> & { publish?: boolean };

export type LayoutMutationResult = {
  ok: boolean;
  status: number;
  layout: FarmLayoutData | null;
  publishedDevices: FarmLayoutDevice[];
  error: string | null;
  networkError: boolean;
};

export type LayoutReloadResult = {
  ok: boolean;
  layout: FarmLayoutData | null;
  error: string | null;
  networkError: boolean;
};

type LayoutMutationData = {
  layout?: FarmLayoutData;
  publishedDevices?: FarmLayoutDevice[];
  error?: string;
};

type LayoutReloadData = {
  layout?: FarmLayoutData;
  error?: string;
};

async function fetchWithSessionRetry(
  url: string,
  init: RequestInit,
): Promise<Response> {
  const response = await fetch(url, { ...init, credentials: "same-origin" });

  if (response.status !== 401) {
    return response;
  }

  const refreshResponse = await fetch("/api/auth/refresh", {
    method: "POST",
    credentials: "same-origin",
  });

  if (!refreshResponse.ok) {
    return response;
  }

  return fetch(url, { ...init, credentials: "same-origin" });
}

export function buildLayoutPayload(
  layout: FarmLayoutData,
  publish = false,
): FarmLayoutPayload {
  return {
    version: layout.version,
    backgroundKey: layout.backgroundKey,
    width: layout.width,
    height: layout.height,
    placements: layout.placements,
    backgroundItems: layout.backgroundItems,
    connections: layout.connections,
    ...(publish ? { publish: true } : {}),
  };
}

export async function saveFarmLayout(
  farmId: string,
  payload: FarmLayoutPayload,
): Promise<LayoutMutationResult> {
  try {
    const response = await fetchWithSessionRetry(
      `/api/admin/farms/${farmId}/layout`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      },
    );
    const data = (await response.json()) as LayoutMutationData;

    return {
      ok: response.ok,
      status: response.status,
      layout: data.layout ?? null,
      publishedDevices: data.publishedDevices ?? [],
      error: data.error ?? null,
      networkError: false,
    };
  } catch {
    return {
      ok: false,
      status: 0,
      layout: null,
      publishedDevices: [],
      error: null,
      networkError: true,
    };
  }
}

export async function reloadFarmLayout(
  farmId: string,
): Promise<LayoutReloadResult> {
  try {
    const response = await fetchWithSessionRetry(
      `/api/admin/farms/${farmId}/layout`,
      {},
    );
    const data = (await response.json()) as LayoutReloadData;

    return {
      ok: response.ok,
      layout: data.layout ?? null,
      error: data.error ?? null,
      networkError: false,
    };
  } catch {
    return {
      ok: false,
      layout: null,
      error: null,
      networkError: true,
    };
  }
}
