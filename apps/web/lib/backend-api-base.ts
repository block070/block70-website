/**
 * FastAPI origin for server-side fetches. Safe to import from client-safe modules (no "server-only").
 * Prefer this over getApiBaseUrl() when calling /api/v1/* from Node so production hits api.block70.com
 * instead of the Vercel marketing host (which has no proxy for many market routes).
 */

export function hostOf(urlish: string): string | null {
  const s = urlish.trim();
  if (!s) return null;
  try {
    const u = s.includes("://") ? new URL(s) : new URL(`https://${s}`);
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

const BLOCK70_PROD_API = "https://api.block70.com";
const BLOCK70_DEV_RELAY_ORIGIN = "https://www.block70.com";

function inferredApiBaseFromSiteUrl(): string {
  for (const env of [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.SITEMAP_BASE_URL,
  ]) {
    const h = hostOf(env?.replace(/\/$/, "") ?? "");
    if (h === "block70.com" || h === "www.block70.com") {
      return process.env.NODE_ENV === "development" ? BLOCK70_DEV_RELAY_ORIGIN : BLOCK70_PROD_API;
    }
  }
  return "";
}

/**
 * Backend base for FastAPI only. Avoid using the Next marketing / Vercel preview host here.
 */
export function getBackendApiBase(): string {
  const server = process.env.API_SERVER_URL?.replace(/\/$/, "") ?? "";
  if (server) return server;

  const pub = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";
  if (!pub) {
    const fromSite = inferredApiBaseFromSiteUrl();
    if (fromSite) return fromSite;
    if (process.env.NODE_ENV === "development") {
      console.warn(
        "[backend-api-base] No API_SERVER_URL or NEXT_PUBLIC_API_BASE_URL; using www.block70.com relay. For direct FastAPI use API_SERVER_URL.",
      );
      return BLOCK70_DEV_RELAY_ORIGIN;
    }
    return "";
  }

  const pubHost = hostOf(pub);
  if (!pubHost) return pub;

  const candidates: string[] = [];
  if (process.env.NEXT_PUBLIC_SITE_URL) candidates.push(process.env.NEXT_PUBLIC_SITE_URL);
  if (process.env.SITEMAP_BASE_URL) candidates.push(process.env.SITEMAP_BASE_URL);
  if (process.env.VERCEL_URL) candidates.push(`https://${process.env.VERCEL_URL}`);

  for (const c of candidates) {
    const h = hostOf(c.replace(/\/$/, ""));
    if (h && h === pubHost) {
      console.warn(
        "[backend-api-base] NEXT_PUBLIC_API_BASE_URL hostname matches site URL; refusing it as API base. Set API_SERVER_URL to your FastAPI origin.",
      );
      const inferred = inferredApiBaseFromSiteUrl();
      if (inferred) return inferred;
      if (pubHost === "www.block70.com" || pubHost === "block70.com") {
        return BLOCK70_PROD_API;
      }
      return "";
    }
  }

  return pub;
}
