export type ComponentStatus = "operational" | "degraded" | "outage";

export type PlatformComponent = {
  name: string;
  status: ComponentStatus;
  detail: string | null;
  latency_ms?: number | null;
};

import { mustUseSameOriginApiProxy } from "./browser-api-proxy";

export type PlatformStatusResponse = {
  checked_at: string;
  overall: ComponentStatus;
  components: {
    api: PlatformComponent;
    signals: PlatformComponent;
    ai: PlatformComponent;
  };
};

async function resolveApiBase(): Promise<string> {
  try {
    const config = await fetch("/api/config", { cache: "no-store" });
    const { apiBase: base } = (await config.json()) as { apiBase: string };
    if (base) return base.replace(/\/$/, "");
  } catch {
    /* ignore */
  }
  if (typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:8000`.replace(/\/$/, "");
  }
  return "";
}

export async function getPlatformStatus(): Promise<PlatformStatusResponse> {
  const apiBase = await resolveApiBase();
  const useProxy = !apiBase.trim() || mustUseSameOriginApiProxy(apiBase);
  const url = useProxy
    ? "/api/status/platform"
    : `${apiBase.replace(/\/$/, "")}/api/v1/status/platform`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Platform status failed: ${res.status}`);
  }
  return (await res.json()) as PlatformStatusResponse;
}
