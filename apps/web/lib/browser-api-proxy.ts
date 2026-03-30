/**
 * Browsers block HTTP API URLs when the page is HTTPS (mixed content).
 * Prefer same-origin `/api/*` routes (server-side proxy) in that case.
 */
export function mustUseSameOriginApiProxy(apiBase: string): boolean {
  if (typeof window === "undefined") return false;
  if (window.location.protocol !== "https:") return false;
  const b = (apiBase || "").trim();
  if (!b) return true;
  return /^http:\/\//i.test(b);
}
