import "server-only";

import type {
  NarrativeIntelligenceDetail,
  NarrativeIntelligenceListResponse,
} from "../types";
import {
  intelligenceDetailFromTrendingSlug,
  syntheticNarrativesFromTrending,
  type TrendOpp,
} from "./trending-fallback";

import { appendFileSync, readFileSync } from "node:fs";
import { join } from "node:path";

const FETCH_MS = 25_000;

export type BackendGetResult = {
  ok: boolean;
  status: number;
  text: () => Promise<string>;
  json: () => Promise<unknown>;
};

function tlsErrorMessage(err: unknown): string {
  const parts: string[] = [];
  if (err instanceof Error) {
    parts.push(err.message);
    if (err.cause instanceof Error) parts.push(err.cause.message);
    else if (err.cause !== undefined) parts.push(String(err.cause));
  } else parts.push(String(err));
  return parts.join(" ");
}

/** True when Node/undici rejects TLS because the cert SANs don't match the HTTPS host (runtime-verified for api.block70.com). */
function isCertSanMismatch(err: unknown): boolean {
  const m = tlsErrorMessage(err);
  return (
    m.includes("does not match certificate") ||
    m.includes("Hostname/IP does not match") ||
    m.includes("cert's altnames")
  );
}

function httpFallbackBaseForCertRetry(): { base: string; explicit: boolean } {
  const env =
    process.env.NARRATIVES_HTTP_FALLBACK_BASE?.replace(/\/$/, "") ?? "";
  if (env) return { base: env, explicit: true };
  if (process.env.NODE_ENV === "development")
    return { base: "http://127.0.0.1:8000", explicit: false };
  return { base: "", explicit: false };
}

function shouldTryHttpAfterCertError(u: URL, hasExplicitHttpFallback: boolean) {
  if (u.protocol !== "https:") return false;
  if (hasExplicitHttpFallback) return true;
  return u.hostname === "api.block70.com";
}

/** GET to FastAPI; if HTTPS fails TLS hostname verification (mis-issued cert for api.block70.com), retry plain HTTP (dev: localhost:8000, or NARRATIVES_HTTP_FALLBACK_BASE). */
export async function backendGet(
  urlStr: string,
  reqHeaders: Record<string, string> = {},
): Promise<BackendGetResult> {
  const doFetch = (url: string) =>
    fetch(url, {
      cache: "no-store",
      headers: { Accept: "application/json", ...reqHeaders },
      signal: AbortSignal.timeout(FETCH_MS),
    });

  try {
    const r = await doFetch(urlStr);
    return {
      ok: r.ok,
      status: r.status,
      text: () => r.text(),
      json: () => r.json(),
    };
  } catch (first) {
    const u = new URL(urlStr);
    const { base: fbBase, explicit } = httpFallbackBaseForCertRetry();
    if (
      fbBase &&
      isCertSanMismatch(first) &&
      shouldTryHttpAfterCertError(u, explicit)
    ) {
      try {
        const path = `${u.pathname}${u.search}`;
        const r = await doFetch(`${fbBase}${path}`);
        // #region agent log
        narrDbg(
          "resolve-narratives-api.ts:backendGet",
          "http fallback after TLS SAN mismatch",
          "H7",
          { httpsHost: u.hostname, httpFallback: fbBase, status: r.status },
        );
        // #endregion
        return {
          ok: r.ok,
          status: r.status,
          text: () => r.text(),
          json: () => r.json(),
        };
      } catch (httpErr) {
        // #region agent log
        narrDbg(
          "resolve-narratives-api.ts:backendGet",
          "http fallback after TLS SAN mismatch failed",
          "H7b",
          {
            httpFallback: fbBase,
            httpErr:
              httpErr instanceof Error
                ? httpErr.message
                : String(httpErr).slice(0, 200),
          },
        );
        // #endregion
        if (process.env.NODE_ENV === "development") {
          console.warn(
            `[resolve-narratives] TLS failed for ${u.hostname}; HTTP retry to ${fbBase} also failed. Start FastAPI on :8000 or set NARRATIVES_HTTP_FALLBACK_BASE.`,
          );
        }
        throw first;
      }
    }
    throw first;
  }
}

/** POST JSON to FastAPI; same TLS + HTTP fallback behavior as {@link backendGet}. */
export async function backendPostJson(
  urlStr: string,
  body: unknown,
  reqHeaders: Record<string, string> = {},
): Promise<BackendGetResult> {
  const jsonBody = JSON.stringify(body);
  const doFetch = (url: string) =>
    fetch(url, {
      method: "POST",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...reqHeaders,
      },
      body: jsonBody,
      signal: AbortSignal.timeout(FETCH_MS),
    });

  try {
    const r = await doFetch(urlStr);
    return {
      ok: r.ok,
      status: r.status,
      text: () => r.text(),
      json: () => r.json(),
    };
  } catch (first) {
    const u = new URL(urlStr);
    const { base: fbBase, explicit } = httpFallbackBaseForCertRetry();
    if (
      fbBase &&
      isCertSanMismatch(first) &&
      shouldTryHttpAfterCertError(u, explicit)
    ) {
      try {
        const path = `${u.pathname}${u.search}`;
        const r = await doFetch(`${fbBase}${path}`);
        narrDbg(
          "resolve-narratives-api.ts:backendPostJson",
          "http fallback after TLS SAN mismatch",
          "H7post",
          { httpsHost: u.hostname, httpFallback: fbBase, status: r.status },
        );
        return {
          ok: r.ok,
          status: r.status,
          text: () => r.text(),
          json: () => r.json(),
        };
      } catch {
        throw first;
      }
    }
    throw first;
  }
}

// #region agent log
function debugNdjsonPath(): string | null {
  let dir = process.cwd();
  for (let i = 0; i < 8; i++) {
    try {
      const pkg = readFileSync(join(dir, "package.json"), "utf8");
      if (/"name"\s*:\s*"block70"/.test(pkg)) {
        return join(dir, "debug-9aa1f6.log");
      }
    } catch {
      /* no package.json */
    }
    const parent = join(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return join(process.cwd(), "debug-9aa1f6.log");
}

function narrDbg(
  location: string,
  message: string,
  hypothesisId: string,
  data: Record<string, unknown>,
) {
  const payload = {
    sessionId: "9aa1f6",
    location,
    message,
    data,
    timestamp: Date.now(),
    hypothesisId,
  };
  const line = `${JSON.stringify(payload)}\n`;
  const p = debugNdjsonPath();
  if (p) {
    try {
      appendFileSync(p, line);
    } catch {
      /* ignore */
    }
  }
  fetch("http://127.0.0.1:7428/ingest/b2bee36a-3f9b-42a9-b6fb-0dc54bacc543", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Debug-Session-Id": "9aa1f6",
    },
    body: JSON.stringify(payload),
  }).catch(() => {});
}
// #endregion

function hostOf(urlish: string): string | null {
  const s = urlish.trim();
  if (!s) return null;
  try {
    const u = s.includes("://") ? new URL(s) : new URL(`https://${s}`);
    return u.hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Public hostname; TLS must include this in SAN. If Node reports cert/hostname mismatch, use API_SERVER_URL or NARRATIVES_HTTP_FALLBACK_BASE. */
/** Production HTTPS origin for FastAPI when TLS is valid for api.block70.com. */
const BLOCK70_PROD_API = "https://api.block70.com";

/**
 * In development, call the live Next route on www (cert includes www SAN). Production
 * then uses API_SERVER_URL to reach Python, avoiding local TLS failure on api.block70.com.
 */
const BLOCK70_DEV_RELAY_ORIGIN = "https://www.block70.com";

/**
 * When no explicit API base env vars are set, infer the public FastAPI origin from the
 * deployed site URL (Block70 production only). Avoids an empty narratives dashboard when
 * `API_SERVER_URL` was omitted but `NEXT_PUBLIC_SITE_URL` points at block70.com.
 */
function inferredApiBaseFromSiteUrl(): string {
  for (const env of [
    process.env.NEXT_PUBLIC_SITE_URL,
    process.env.SITEMAP_BASE_URL,
  ]) {
    const h = hostOf(env?.replace(/\/$/, "") ?? "");
    if (h === "block70.com" || h === "www.block70.com") {
      return process.env.NODE_ENV === "development"
        ? BLOCK70_DEV_RELAY_ORIGIN
        : BLOCK70_PROD_API;
    }
  }
  return "";
}

/**
 * Backend base for FastAPI only. Avoid using the Next marketing host here — it causes
 * recursive / wrong fetches when NEXT_PUBLIC_API_BASE_URL is mis-set to the web origin.
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
        "[resolve-narratives] No API_SERVER_URL or NEXT_PUBLIC_API_BASE_URL; using www.block70.com relay (avoids broken api.block70.com TLS in dev). For direct FastAPI use API_SERVER_URL.",
      );
      return BLOCK70_DEV_RELAY_ORIGIN;
    }
    return "";
  }

  const pubHost = hostOf(pub);
  if (!pubHost) return pub;

  const candidates: string[] = [];
  if (process.env.NEXT_PUBLIC_SITE_URL)
    candidates.push(process.env.NEXT_PUBLIC_SITE_URL);
  if (process.env.SITEMAP_BASE_URL) candidates.push(process.env.SITEMAP_BASE_URL);
  if (process.env.VERCEL_URL)
    candidates.push(`https://${process.env.VERCEL_URL}`);

  for (const c of candidates) {
    const h = hostOf(c.replace(/\/$/, ""));
    if (h && h === pubHost) {
      console.warn(
        "[resolve-narratives] NEXT_PUBLIC_API_BASE_URL hostname matches site URL; refusing it as API base. Set API_SERVER_URL (or NARRATIVES_HTTP_FALLBACK_BASE for plain HTTP) to your FastAPI origin.",
      );
      return "";
    }
  }

  return pub;
}

export type NarrativesIntelligenceMeta = {
  source:
    | "upstream"
    | "trending-fallback"
    | "upstream-empty"
    | "no-api-base"
    | "empty"
    | "trending-only-after-intel-error";
  intelStatus?: number;
  intelCount?: number;
  trendingStatus?: number;
  opportunitiesListStatus?: number;
  oppsLen?: number;
  syntheticLen?: number;
  /** Where narrative-type opportunity rows were loaded for synthetic cards */
  narrativeOppsSource?: "trending" | "opportunities-list";
  /** Resolver trace for debugging (also sent as X-Narratives-DBG on the API route). No secrets / no URLs. */
  resolveDbg?: Record<string, unknown>;
};

export type NarrativeDetailMeta = {
  source: "upstream" | "trending-fallback" | "no-api-base" | "not-found";
};

/**
 * Load active narrative-type opportunities: try /narratives/trending first, then full list.
 */
async function loadNarrativeTypeOpportunities(base: string): Promise<{
  opps: TrendOpp[];
  source: "trending" | "opportunities-list";
  trendingStatus?: number;
  opportunitiesListStatus?: number;
}> {
  try {
    const tr = await backendGet(
      `${base}/api/v1/narratives/trending?limit=100`,
    );
    const trendingStatus = tr.status;
    if (tr.ok) {
      const raw = (await tr.json()) as unknown;
      if (Array.isArray(raw) && raw.length > 0) {
        return { opps: raw as TrendOpp[], source: "trending", trendingStatus };
      }
    }
  } catch {
    /* try list */
  }

  try {
    const r = await backendGet(
      `${base}/api/v1/opportunities?opportunity_type=${encodeURIComponent(
        "narrative",
      )}`,
    );
    const opportunitiesListStatus = r.status;
    if (r.ok) {
      const raw = (await r.json()) as unknown;
      if (Array.isArray(raw) && raw.length > 0) {
        return {
          opps: (raw as TrendOpp[]).slice(0, 200),
          source: "opportunities-list",
          opportunitiesListStatus,
        };
      }
    }
    return {
      opps: [],
      source: "opportunities-list",
      opportunitiesListStatus,
    };
  } catch {
    return { opps: [], source: "opportunities-list" };
  }
}

async function trySyntheticPayloadFromNarrativeOpps(
  base: string,
  limit: number,
): Promise<{
  payload: NarrativeIntelligenceListResponse;
  metaExtra: Pick<
    NarrativesIntelligenceMeta,
    | "trendingStatus"
    | "opportunitiesListStatus"
    | "oppsLen"
    | "syntheticLen"
    | "narrativeOppsSource"
  >;
} | null> {
  const { opps, source, trendingStatus, opportunitiesListStatus } =
    await loadNarrativeTypeOpportunities(base);
  if (!opps.length) return null;
  const synthetic = syntheticNarrativesFromTrending(opps, limit);
  if (!synthetic.length) return null;
  return {
    payload: {
      narratives: synthetic as NarrativeIntelligenceListResponse["narratives"],
      computed_at: new Date().toISOString(),
    },
    metaExtra: {
      trendingStatus,
      opportunitiesListStatus,
      oppsLen: opps.length,
      syntheticLen: synthetic.length,
      narrativeOppsSource: source,
    },
  };
}

export async function resolveNarrativesIntelligence(limit: number): Promise<{
  payload: NarrativeIntelligenceListResponse;
  meta: NarrativesIntelligenceMeta;
}> {
  const cap = Math.min(200, Math.max(1, limit));
  const base = getBackendApiBase();
  const trace: Record<string, unknown> = {
    hasBase: Boolean(base),
    envApiSrv: Boolean(process.env.API_SERVER_URL),
    envPubApi: Boolean(process.env.NEXT_PUBLIC_API_BASE_URL),
  };

  // #region agent log
  narrDbg(
    "resolve-narratives-api.ts:resolveNarrativesIntelligence:base",
    "backend base resolved",
    "H1",
    {
      hasBase: Boolean(base),
      baseLen: base.length,
      hasApiServerUrl: Boolean(process.env.API_SERVER_URL),
      hasPublicApiBase: Boolean(process.env.NEXT_PUBLIC_API_BASE_URL),
    },
  );
  // #endregion

  if (!base) {
    trace.exit = "no-api-base";
    return {
      payload: {
        narratives: [],
        computed_at: new Date().toISOString(),
      },
      meta: { source: "no-api-base", resolveDbg: trace },
    };
  }

  const intelUrl = `${base}/api/v1/narratives/intelligence?limit=${encodeURIComponent(String(cap))}`;

  try {
    const upstream = await backendGet(intelUrl);
    const intelStatus = upstream.status;
    const rawText = await upstream.text();
    let parsed: Record<string, unknown> | null = null;
    try {
      parsed = JSON.parse(rawText) as Record<string, unknown>;
    } catch {
      parsed = null;
    }
    const narrativesArr = parsed?.narratives;
    const intelCount = Array.isArray(narrativesArr) ? narrativesArr.length : -1;
    const hasRows =
      upstream.ok &&
      parsed !== null &&
      Array.isArray(narrativesArr) &&
      narrativesArr.length > 0;

    Object.assign(trace, {
      intelStatus,
      intelCount,
      hasRows,
      rawLen: rawText.length,
      jsonOk: parsed !== null,
    });

    // #region agent log
    narrDbg(
      "resolve-narratives-api.ts:resolveNarrativesIntelligence:intel",
      "upstream intelligence response",
      "H2",
      {
        intelStatus,
        intelCount,
        hasRows,
        rawLen: rawText.length,
        parsedNull: parsed === null,
      },
    );
    // #endregion

    if (hasRows) {
      trace.exit = "upstream-rows";
      return {
        payload: parsed as unknown as NarrativeIntelligenceListResponse,
        meta: {
          source: "upstream",
          intelStatus,
          intelCount,
          resolveDbg: trace,
        },
      };
    }

    const syn = await trySyntheticPayloadFromNarrativeOpps(base, cap);
    // #region agent log
    narrDbg(
      "resolve-narratives-api.ts:resolveNarrativesIntelligence:afterFirstSyn",
      "first synthetic attempt",
      "H3",
      {
        synOk: Boolean(syn),
        syntheticLen: syn?.metaExtra.syntheticLen,
        oppsLen: syn?.metaExtra.oppsLen,
        narrativeOppsSource: syn?.metaExtra.narrativeOppsSource,
        trendingStatus: syn?.metaExtra.trendingStatus,
        opportunitiesListStatus: syn?.metaExtra.opportunitiesListStatus,
      },
    );
    // #endregion
    if (syn) {
      trace.exit = "trending-fallback";
      Object.assign(trace, {
        firstSynOk: true,
        oppsLen: syn.metaExtra.oppsLen,
        syntheticLen: syn.metaExtra.syntheticLen,
        narrativeOppsSource: syn.metaExtra.narrativeOppsSource,
      });
      return {
        payload: syn.payload,
        meta: {
          source: "trending-fallback",
          intelStatus,
          intelCount,
          ...syn.metaExtra,
          resolveDbg: trace,
        },
      };
    }

    trace.firstSynOk = false;

    if (upstream.ok && parsed !== null && Array.isArray(narrativesArr)) {
      trace.exit = "upstream-empty";
      return {
        payload: parsed as unknown as NarrativeIntelligenceListResponse,
        meta: {
          source: "upstream-empty",
          intelStatus,
          intelCount: 0,
          resolveDbg: trace,
        },
      };
    }
  } catch (err) {
    trace.intelThrew = true;
    trace.intelErrKind =
      err instanceof Error ? err.name : typeof err;
    trace.intelErrMsg =
      err instanceof Error
        ? err.message.slice(0, 200)
        : String(err).slice(0, 200);
    if (err instanceof Error && err.cause !== undefined) {
      trace.intelErrCause =
        err.cause instanceof Error
          ? `${err.cause.name}: ${err.cause.message}`.slice(0, 300)
          : String(err.cause).slice(0, 300);
    }
    // #region agent log
    narrDbg(
      "resolve-narratives-api.ts:resolveNarrativesIntelligence:intelCatch",
      "intel fetch or parse threw",
      "H4",
      {
        errName: err instanceof Error ? err.name : typeof err,
        errMessage: err instanceof Error ? err.message : String(err),
        errCause: trace.intelErrCause,
      },
    );
    // #endregion
    /* intel fetch / parse threw */
  }

  const synOnly = await trySyntheticPayloadFromNarrativeOpps(base, cap);
  if (synOnly) {
    trace.exit = "trending-only-after-intel-error";
    Object.assign(trace, {
      secondSynOk: true,
      oppsLen: synOnly.metaExtra.oppsLen,
      syntheticLen: synOnly.metaExtra.syntheticLen,
      narrativeOppsSource: synOnly.metaExtra.narrativeOppsSource,
    });
    return {
      payload: synOnly.payload,
      meta: {
        source: "trending-only-after-intel-error",
        ...synOnly.metaExtra,
        resolveDbg: trace,
      },
    };
  }

  trace.secondSynOk = false;
  trace.exit = "empty";
  trace.apiHost = hostOf(base);

  // #region agent log
  narrDbg(
    "resolve-narratives-api.ts:resolveNarrativesIntelligence:empty",
    "returning empty narratives list",
    "H5",
    { cap, baseHost: hostOf(base) },
  );
  // #endregion

  return {
    payload: {
      narratives: [],
      computed_at: new Date().toISOString(),
    },
    meta: { source: "empty", resolveDbg: trace },
  };
}

export async function resolveNarrativeDetail(
  slug: string,
  opportunityLimit: number,
): Promise<{
  payload: NarrativeIntelligenceDetail | null;
  meta: NarrativeDetailMeta;
}> {
  const base = getBackendApiBase();
  const oppLimit = Math.min(200, Math.max(1, opportunityLimit));

  if (!base) {
    return { payload: null, meta: { source: "no-api-base" } };
  }

  const q = new URLSearchParams();
  q.set("slug", slug);
  q.set("opportunity_limit", String(oppLimit));

  try {
    const upstream = await backendGet(
      `${base}/api/v1/narratives/detail?${q.toString()}`,
    );
    if (upstream.ok) {
      const data = (await upstream.json()) as NarrativeIntelligenceDetail;
      return { payload: data, meta: { source: "upstream" } };
    }
  } catch {
    /* fallback */
  }

  let decoded = slug.trim();
  try {
    decoded = decodeURIComponent(slug).trim();
  } catch {
    decoded = slug.trim();
  }

  const { opps } = await loadNarrativeTypeOpportunities(base);
  if (opps.length) {
    const detail = intelligenceDetailFromTrendingSlug(decoded, opps);
    if (detail) {
      const all = detail.opportunities;
      const opportunities = Array.isArray(all)
        ? (all as TrendOpp[]).slice(0, oppLimit)
        : [];
      return {
        payload: {
          ...(detail as unknown as NarrativeIntelligenceDetail),
          opportunities: opportunities as NarrativeIntelligenceDetail["opportunities"],
        },
        meta: { source: "trending-fallback" },
      };
    }
  }

  return { payload: null, meta: { source: "not-found" } };
}
