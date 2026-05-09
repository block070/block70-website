// Real Upland source. Hydrates properties via the internal detail endpoint
// `GET {baseUrl}/api/properties/{prop_id}` — the same endpoint the play.upland.me
// web app uses when the user clicks a parcel. This is the only endpoint we've
// confirmed returns the fields Block70 cares about (price, yield, owner,
// status, city, etc). See docs/upland-property-search.md for the full capture.
//
// Status:
//   * Detail hydration:  WORKING. Confirmed against Kansas City prop 80257908844220.
//   * Bbox list discovery: DEFERRED. The bbox list URL has not been positively
//     identified yet. For now this source is driven by an explicit list of
//     prop_ids (env UPLAND_PROPERTY_IDS or per-request `propIds` in the trigger
//     body). Once the list endpoint is captured we'll add a second internal
//     helper here; the detail-per-id path stays the source of truth for the
//     fields we actually persist.
//
// Safety:
//   * Token is read from env only — never logged, never echoed in errors.
//   * Every request sends the headers play.upland.me uses (appversion, locale,
//     platform, origin, referer). Missing any of these commonly triggers a
//     4xx on upland.me's edge.
//   * Rate-limited via UPLAND_RATE_LIMIT_MS (default 500ms between calls).
//   * 429/5xx trigger exponential backoff; 4xx otherwise fails the run fast
//     so config / token issues surface immediately instead of silently
//     writing zero rows.

import {
  type IngestionPage,
  type NormalizedProperty,
  type PropertySource,
} from "./PropertySource";

// Shape of the `/api/properties/{id}` response. Only the fields we read are
// declared; everything else stays under `raw` for forensic debugging.
type UplandDetailResponse = {
  prop_id?: number | string;
  full_address?: string | null;
  addressWithCityAndState?: string | null;
  centerlat?: string | number | null;
  centerlng?: string | number | null;
  area?: number | null;
  status?: string | null; // "For sale" | "Unlocked" | "Owned" | "Locked" | ...
  price?: number | string | null;
  last_purchased_price?: number | string | null;
  yield_per_hour?: number | string | null;
  owner?: string | null;
  owner_username?: string | null;
  is_owner_in_jail?: boolean | null;
  collection_boost?: number | null;
  street?: { id?: number; name?: string | null } | null;
  city?: { id?: number; name?: string | null } | null;
  state?: { id?: number; name?: string | null } | null;
  building?: { type?: string | null; name?: string | null } | null;
  buildings?: Array<{ type?: string | null; name?: string | null }>;
  on_market?: {
    token?: string | null;
    fiat?: string | null;
    currency?: string | null;
  } | null;
  is_blocked?: boolean | null;
  [k: string]: unknown;
};

export type UplandOfficialSourceOptions = {
  propIds?: string[];
  baseUrl?: string;
  pageSize?: number;
  rateLimitMs?: number;
  /**
   * Strict mode: abort the run on any per-id failure. Default false — we skip
   * failed ids and continue, so a handful of 404s don't wreck a long run.
   */
  strict?: boolean;
};

export class UplandOfficialSource implements PropertySource {
  public readonly name = "upland-official";

  private readonly baseUrl: string;
  private readonly pageSize: number;
  private readonly rateLimitMs: number;
  private readonly propIds: string[];
  private readonly strict: boolean;

  constructor(opts: UplandOfficialSourceOptions = {}) {
    this.baseUrl = (opts.baseUrl ?? process.env.UPLAND_API_BASE_URL ?? "https://api.prod.upland.me")
      .trim()
      .replace(/\/+$/, "");
    this.pageSize = clampInt(opts.pageSize ?? Number(process.env.UPLAND_PAGE_SIZE ?? 50), 1, 500);
    this.rateLimitMs = Math.max(
      0,
      opts.rateLimitMs ?? Number(process.env.UPLAND_RATE_LIMIT_MS ?? 500),
    );
    this.strict = Boolean(opts.strict ?? false);

    const envIds = parseIdList(process.env.UPLAND_PROPERTY_IDS);
    const passedIds = (opts.propIds ?? []).map((s) => s.trim()).filter(Boolean);
    this.propIds = dedupe([...passedIds, ...envIds]);

    if (!this.baseUrl) {
      throw new Error("UplandOfficialSource requires UPLAND_API_BASE_URL.");
    }
    if (!process.env.UPLAND_API_TOKEN) {
      throw new Error(
        "UplandOfficialSource requires UPLAND_API_TOKEN (Bearer JWT from play.upland.me).",
      );
    }
    if (this.propIds.length === 0) {
      throw new Error(
        "UplandOfficialSource requires at least one prop_id " +
          "(UPLAND_PROPERTY_IDS env var or `propIds` in the trigger body). " +
          "Bbox list discovery is not yet wired; see docs/upland-property-search.md.",
      );
    }
  }

  static isEnabled(): boolean {
    return process.env.UPLAND_INGEST_ENABLED === "1";
  }

  async *pages(opts: { maxPages?: number } = {}): AsyncIterable<IngestionPage> {
    const maxPages = Math.max(1, Math.min(opts.maxPages ?? 1000, 10_000));
    const chunks = chunk(this.propIds, this.pageSize);
    const pagesToYield = chunks.slice(0, maxPages);

    for (let pageIdx = 0; pageIdx < pagesToYield.length; pageIdx++) {
      const ids = pagesToYield[pageIdx];
      const items: NormalizedProperty[] = [];

      for (const id of ids) {
        try {
          const detail = await this.fetchDetail(id);
          const norm = normalize(detail);
          if (norm) items.push(norm);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (this.strict) throw err;
          // Skip this id but keep going. Caller sees the gap via ingestion_runs
          // (seen vs upserted deltas) and change_events.
          // eslint-disable-next-line no-console -- deliberate run-level signal
          console.warn(`[upland-official] skip ${id}: ${msg}`);
        }
        if (this.rateLimitMs > 0) {
          await new Promise((r) => setTimeout(r, this.rateLimitMs));
        }
      }

      const hasMore = pageIdx + 1 < pagesToYield.length;
      yield {
        items,
        cursor: hasMore ? String(pageIdx + 1) : null,
      };
    }
  }

  // ---------- HTTP ---------------------------------------------------------

  private async fetchDetail(propId: string): Promise<UplandDetailResponse> {
    const url = `${this.baseUrl}/api/properties/${encodeURIComponent(propId)}`;
    const body = await this.fetchWithRetry(url);
    if (!body || typeof body !== "object") {
      throw new Error(`Upland detail ${propId}: empty response`);
    }
    return body as UplandDetailResponse;
  }

  private async fetchWithRetry(url: string): Promise<Record<string, unknown>> {
    const headers = this.buildHeaders();

    // Up to 3 attempts: 0, 750ms, 2500ms. 429/5xx trigger backoff; other 4xx
    // surfaces immediately so config / token issues are visible.
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
        if (res.status === 401 || res.status === 403) {
          // Don't retry on auth failures — token expired or wrong scope.
          throw new Error(
            `Upland API ${res.status}: token rejected. Rotate UPLAND_API_TOKEN.`,
          );
        }
        if (!res.ok) {
          throw new Error(`Upland API ${res.status}: ${res.statusText}`);
        }
        return (await res.json()) as Record<string, unknown>;
      } catch (err) {
        lastErr = err instanceof Error ? err : new Error(String(err));
        if (err instanceof SyntaxError) throw err;
        if (
          err instanceof Error &&
          /401|403/.test(err.message) &&
          err.message.includes("token rejected")
        ) {
          throw err;
        }
      }
    }
    throw lastErr ?? new Error("Upland fetch failed");
  }

  private buildHeaders(): Record<string, string> {
    const token = process.env.UPLAND_API_TOKEN ?? "";
    const appVersion = process.env.UPLAND_APP_VERSION ?? "0.14.1007";
    const origin = process.env.UPLAND_ORIGIN ?? "https://play.upland.me";
    const referer = process.env.UPLAND_REFERER ?? "https://play.upland.me/";
    const userAgent =
      process.env.UPLAND_USER_AGENT ??
      "block70-upland-sync/0.2 (+https://block70.com)";
    const locale = process.env.UPLAND_LOCALE ?? "en-US";
    const platform = process.env.UPLAND_PLATFORM ?? "web";

    return {
      accept: "application/json",
      "accept-language": "en-US,en;q=0.9",
      "cache-control": "no-cache",
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      appversion: appVersion,
      locale,
      platform,
      origin,
      referer,
      "user-agent": userAgent,
    };
  }
}

// ---------------------------------------------------------------------------
// Normalization: Upland detail response -> NormalizedProperty

export function normalize(raw: UplandDetailResponse): NormalizedProperty | null {
  const propId = raw.prop_id;
  if (propId == null) return null;
  const uplandId = String(propId);

  const fullAddress = (raw.full_address ?? raw.addressWithCityAndState ?? "").trim();
  if (!fullAddress) return null;

  const status = (raw.status ?? "").trim();
  const { forSale, sellerType } = classifyStatus(status);

  // Price: Upland quotes prices in UPX tokens. We persist the raw UPX number;
  // the frontend renders the UPX suffix. `on_market.fiat` (USD) is not
  // persisted yet — add a fiat_price column in a follow-up migration if we
  // start surfacing fiat listings separately.
  const price = toNum(raw.price);
  const lastPurchased = toNum(raw.last_purchased_price);

  // Upland reports yield as UPX/hour per parcel. Convert to a monthly number
  // (24 * 30 = 720 hours). The exact denominator doesn't matter as long as
  // it's stable across the dataset; deal-score normalization handles scaling.
  const yieldPerHour = toNum(raw.yield_per_hour);
  const yieldPerMonth = yieldPerHour != null ? yieldPerHour * 720 : null;

  const city = raw.city?.name?.trim() || "Unknown";
  const state = raw.state?.name?.trim() || null;
  const neighborhood = raw.street?.name?.trim() || null;

  const lat = coerceLatLng(raw.centerlat);
  const lng = coerceLatLng(raw.centerlng);

  // Structure signal. A non-null `building` (singular) is the common case for
  // a completed structure; the `buildings` array is used during multi-stage
  // builds. Either is enough to flag has_structure=true.
  const buildingsArr = Array.isArray(raw.buildings) ? raw.buildings : [];
  const primaryBuilding = raw.building ?? buildingsArr[0] ?? null;
  const hasStructure = primaryBuilding != null;
  const structureType = primaryBuilding?.type?.trim() || null;

  // Collection: Upland uses numeric collection_boost instead of a name here;
  // a richer collection label lives on a separate endpoint. For now we derive
  // a rough "Boosted" label when collection_boost > 1 so the UI has something
  // to show; promote to a real collection name once we wire the collections
  // endpoint.
  const boost = typeof raw.collection_boost === "number" ? raw.collection_boost : null;
  const collection = boost != null && boost > 1 ? `Boosted x${boost}` : null;

  return {
    uplandId,
    address: fullAddress,
    city,
    state,
    country: "US", // Upland's current live geography; update when intl launches
    neighborhood,
    price,
    mintPrice: lastPurchased, // closest proxy we have; not the true mint price
    yieldPerMonth,
    forSale,
    sellerType,
    owner: raw.owner_username?.trim() || raw.owner?.trim() || null,
    lat,
    lng,
    collection,
    hasStructure,
    structureType,
    // Vehicles are wallet-level in Upland, not parcel-level, so the detail
    // endpoint never returns any. Leave empty; a future wallet-scrape source
    // can attach them.
    vehicles: [],
    raw,
  };
}

function classifyStatus(status: string): {
  forSale: boolean;
  sellerType: "player" | "mint" | null;
} {
  const s = status.toLowerCase();
  if (s === "for sale") return { forSale: true, sellerType: "player" };
  if (s === "unlocked") return { forSale: true, sellerType: "mint" };
  return { forSale: false, sellerType: null };
}

// ---------------------------------------------------------------------------
// Utilities

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function coerceLatLng(v: unknown): number | null {
  const n = toNum(v);
  if (n == null) return null;
  if (n < -180 || n > 180) return null;
  return n;
}

function clampInt(v: number, lo: number, hi: number): number {
  const n = Math.floor(v);
  if (!Number.isFinite(n)) return lo;
  return Math.max(lo, Math.min(hi, n));
}

function parseIdList(v: string | undefined): string[] {
  if (!v) return [];
  return v
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function dedupe(xs: string[]): string[] {
  return Array.from(new Set(xs));
}

function chunk<T>(xs: T[], size: number): T[][] {
  if (size <= 0) return [xs];
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += size) out.push(xs.slice(i, i + size));
  return out;
}
