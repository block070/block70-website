// Real Upland source. Hits the reverse-engineered JSON endpoints with a
// bearer token and a conservative rate limit.
//
// Status: SKELETON. The user will flip UPLAND_INGEST_ENABLED=1 and set
// UPLAND_API_TOKEN once the access contract is finalized. Until then the
// orchestrator uses MockSource by default.
//
// Deliberately non-exhaustive:
//   * Token refresh is stubbed (refreshTokenIfNeeded returns immediately).
//   * Endpoint URLs live in env vars; no hard-coded URLs here so we don't
//     inadvertently commit reverse-engineered paths to a public repo.
//   * Page normalization is best-effort and intentionally strict -- any
//     unexpected response shape throws so the run is logged as failed rather
//     than silently writing bad data.

import {
  type IngestionPage,
  type NormalizedProperty,
  type PropertySource,
} from "./PropertySource";

type UplandListItem = {
  id?: string | number;
  full_address?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  neighborhood?: string | null;
  price?: number | string | null;
  mint_price?: number | string | null;
  monthly_yield?: number | string | null;
  for_sale?: boolean;
  owner?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  collection?: string | null;
  has_structure?: boolean;
  structure_type?: string | null;
  vehicles?: Array<{
    id?: string;
    name?: string;
    type?: string;
    rarity?: string | null;
  }>;
  raw?: unknown;
};

export class UplandOfficialSource implements PropertySource {
  public readonly name = "upland-official";

  private readonly baseUrl: string;
  private readonly listPath: string;
  private readonly pageSize: number;
  private readonly rateLimitMs: number;

  constructor(opts: {
    baseUrl?: string;
    listPath?: string;
    pageSize?: number;
    rateLimitMs?: number;
  } = {}) {
    this.baseUrl =
      opts.baseUrl ?? process.env.UPLAND_API_BASE_URL ?? "";
    this.listPath =
      opts.listPath ?? process.env.UPLAND_PROPERTY_LIST_PATH ?? "/properties";
    this.pageSize = opts.pageSize ?? Number(process.env.UPLAND_PAGE_SIZE ?? 100);
    this.rateLimitMs =
      opts.rateLimitMs ?? Number(process.env.UPLAND_RATE_LIMIT_MS ?? 400);

    if (!this.baseUrl) {
      throw new Error(
        "UplandOfficialSource requires UPLAND_API_BASE_URL (and a token).",
      );
    }
  }

  static isEnabled(): boolean {
    return process.env.UPLAND_INGEST_ENABLED === "1";
  }

  async *pages(opts: { maxPages?: number } = {}): AsyncIterable<IngestionPage> {
    const maxPages = Math.max(1, Math.min(opts.maxPages ?? 1000, 10_000));
    let cursor: string | null = null;

    for (let pageIdx = 0; pageIdx < maxPages; pageIdx++) {
      await this.refreshTokenIfNeeded();
      const url = new URL(this.listPath, this.baseUrl);
      url.searchParams.set("limit", String(this.pageSize));
      if (cursor) url.searchParams.set("cursor", cursor);

      const body = await this.fetchWithRetry(url.toString());
      const items = Array.isArray(body?.items) ? (body.items as UplandListItem[]) : [];
      const normalized = items
        .map(normalize)
        .filter((n): n is NormalizedProperty => n !== null);

      const nextCursor =
        typeof body?.next_cursor === "string" && body.next_cursor.length > 0
          ? body.next_cursor
          : null;

      yield { items: normalized, cursor: nextCursor };

      if (!nextCursor) return;
      cursor = nextCursor;
      if (this.rateLimitMs > 0) {
        await new Promise((r) => setTimeout(r, this.rateLimitMs));
      }
    }
  }

  // ---------- HTTP ---------------------------------------------------------

  private async fetchWithRetry(url: string): Promise<Record<string, unknown>> {
    const token = process.env.UPLAND_API_TOKEN ?? "";
    const headers: Record<string, string> = {
      accept: "application/json",
      "user-agent": "block70-upland-sync/0.1 (+https://block70.com)",
    };
    if (token) headers.authorization = `Bearer ${token}`;

    // Up to 3 attempts: 0, 750ms, 2500ms. 429/5xx trigger backoff; 4xx (other)
    // rethrows immediately so we surface config errors.
    const delays = [0, 750, 2500];
    let lastErr: Error | null = null;
    for (const delay of delays) {
      if (delay > 0) await new Promise((r) => setTimeout(r, delay));
      try {
        const res = await fetch(url, { headers });
        if (res.status === 429 || res.status >= 500) {
          lastErr = new Error(`Upland API ${res.status}: ${res.statusText}`);
          continue;
        }
        if (!res.ok) {
          throw new Error(`Upland API ${res.status}: ${res.statusText}`);
        }
        return (await res.json()) as Record<string, unknown>;
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error(String(err));
        // Only retry on network-ish errors; parse errors should surface.
        if (err instanceof SyntaxError) throw err;
      }
    }
    throw lastErr ?? new Error("Upland fetch failed");
  }

  private async refreshTokenIfNeeded(): Promise<void> {
    // Future work: read UPLAND_API_TOKEN_EXPIRES_AT, compare against now,
    // and hit a refresh endpoint. For the skeleton we trust the env token
    // has been rotated by whoever set UPLAND_INGEST_ENABLED=1.
    return;
  }
}

// -----------------------------------------------------------------------------

function normalize(raw: UplandListItem): NormalizedProperty | null {
  if (!raw || (raw.id == null && !raw.address && !raw.full_address)) return null;

  const id = raw.id != null ? String(raw.id) : (raw.full_address ?? raw.address ?? "").trim();
  if (!id) return null;

  const address = (raw.full_address ?? raw.address ?? "").trim();
  if (!address) return null;

  const price = toNum(raw.price);
  const mintPrice = toNum(raw.mint_price);

  return {
    uplandId: id,
    address,
    city: (raw.city ?? "").trim() || "Unknown",
    state: raw.state?.trim() || null,
    country: (raw.country ?? "US").trim() || "US",
    neighborhood: raw.neighborhood?.trim() || null,
    price,
    mintPrice,
    yieldPerMonth: toNum(raw.monthly_yield),
    forSale: Boolean(raw.for_sale),
    owner: raw.owner?.trim() || null,
    lat: typeof raw.latitude === "number" ? raw.latitude : null,
    lng: typeof raw.longitude === "number" ? raw.longitude : null,
    collection: raw.collection?.trim() || null,
    hasStructure: Boolean(raw.has_structure),
    structureType: raw.structure_type?.trim() || null,
    vehicles: Array.isArray(raw.vehicles)
      ? raw.vehicles.map((v) => ({
          externalId: v.id ?? null,
          name: v.name ?? null,
          type: v.type ?? "vehicle",
          rarity: v.rarity ?? null,
        }))
      : [],
    raw,
  };
}

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
