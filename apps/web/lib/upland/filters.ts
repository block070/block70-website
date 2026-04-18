// Zod schema + URL <-> filter codec.
//
// Every place that accepts user input -- the API route, middleware, and the
// frontend URL parser -- funnels through `parseFiltersFromSearchParams`. That
// way, filter semantics live in exactly one place.

import { z } from "zod";
import type { SortKey, SortOrder } from "./types";

// Coerce helpers: URLSearchParams yields strings; we want numbers/booleans.
const numberFromString = z
  .string()
  .trim()
  .transform((v, ctx) => {
    if (v === "") return undefined;
    const n = Number(v);
    if (!Number.isFinite(n)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "must be a number" });
      return z.NEVER;
    }
    return n;
  });

const booleanFromFlag = z
  .string()
  .optional()
  .transform((v) => {
    if (v == null) return undefined;
    const t = v.trim().toLowerCase();
    if (t === "1" || t === "true" || t === "yes") return true;
    if (t === "0" || t === "false" || t === "no") return false;
    return undefined;
  });

const SORT_KEYS: SortKey[] = [
  "recent",
  "price",
  "yield",
  "markup",
  "vehicles",
  "deal",
];
const SORT_ORDERS: SortOrder[] = ["asc", "desc"];

export const filtersSchema = z.object({
  // Cities: repeatable. A single string OR an array after getAll().
  city: z.array(z.string()).optional().default([]),
  state: z.string().trim().min(1).max(64).optional(),
  country: z.string().trim().min(1).max(64).optional(),
  neighborhood: z.string().trim().min(1).max(120).optional(),
  minPrice: numberFromString.optional(),
  maxPrice: numberFromString.optional(),
  minYield: numberFromString.optional(),
  maxYield: numberFromString.optional(),
  minMarkup: numberFromString.optional(),
  maxMarkup: numberFromString.optional(),
  forSale: booleanFromFlag.optional(),
  hasVehicles: booleanFromFlag.optional(),
  hasStructures: booleanFromFlag.optional(),
  hiddenGem: booleanFromFlag.optional(),
  minScore: numberFromString.optional(),
  maxScore: numberFromString.optional(),
  owner: z.string().trim().max(128).optional(),
  q: z.string().trim().max(120).optional(),
  sortBy: z.enum(SORT_KEYS as [SortKey, ...SortKey[]]).optional().default("recent"),
  order: z.enum(SORT_ORDERS as [SortOrder, ...SortOrder[]]).optional().default("desc"),
  cursor: z.string().trim().max(64).optional(),
  limit: numberFromString.optional().transform((v) => {
    if (v === undefined) return 50;
    return Math.max(1, Math.min(100, Math.floor(v)));
  }),
  include: z
    .array(z.string())
    .optional()
    .default([])
    .transform((xs) => new Set(xs.flatMap((s) => s.split(",")).map((s) => s.trim()).filter(Boolean))),
});

export type UplandFilters = z.infer<typeof filtersSchema>;

export function parseFiltersFromSearchParams(
  params: URLSearchParams,
): { ok: true; filters: UplandFilters } | { ok: false; error: string } {
  // URLSearchParams.getAll returns repeated values for the same key, which is
  // what we want for `city`. Zod handles the rest.
  const raw: Record<string, unknown> = {
    city: params.getAll("city"),
    state: params.get("state") ?? undefined,
    country: params.get("country") ?? undefined,
    neighborhood: params.get("neighborhood") ?? undefined,
    minPrice: params.get("minPrice") ?? undefined,
    maxPrice: params.get("maxPrice") ?? undefined,
    minYield: params.get("minYield") ?? undefined,
    maxYield: params.get("maxYield") ?? undefined,
    minMarkup: params.get("minMarkup") ?? undefined,
    maxMarkup: params.get("maxMarkup") ?? undefined,
    forSale: params.get("forSale") ?? undefined,
    hasVehicles: params.get("hasVehicles") ?? undefined,
    hasStructures: params.get("hasStructures") ?? undefined,
    hiddenGem: params.get("hiddenGem") ?? undefined,
    minScore: params.get("minScore") ?? undefined,
    maxScore: params.get("maxScore") ?? undefined,
    owner: params.get("owner") ?? undefined,
    q: params.get("q") ?? undefined,
    sortBy: params.get("sortBy") ?? undefined,
    order: params.get("order") ?? undefined,
    cursor: params.get("cursor") ?? undefined,
    limit: params.get("limit") ?? undefined,
    include: params.getAll("include"),
  };
  const result = filtersSchema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      error: result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    };
  }
  return { ok: true, filters: result.data };
}

export function filtersToSearchParams(f: Partial<UplandFilters>): URLSearchParams {
  const p = new URLSearchParams();
  (f.city ?? []).forEach((c) => p.append("city", c));
  if (f.state) p.set("state", f.state);
  if (f.country) p.set("country", f.country);
  if (f.neighborhood) p.set("neighborhood", f.neighborhood);
  if (f.minPrice !== undefined) p.set("minPrice", String(f.minPrice));
  if (f.maxPrice !== undefined) p.set("maxPrice", String(f.maxPrice));
  if (f.minYield !== undefined) p.set("minYield", String(f.minYield));
  if (f.maxYield !== undefined) p.set("maxYield", String(f.maxYield));
  if (f.minMarkup !== undefined) p.set("minMarkup", String(f.minMarkup));
  if (f.maxMarkup !== undefined) p.set("maxMarkup", String(f.maxMarkup));
  if (f.forSale !== undefined) p.set("forSale", f.forSale ? "1" : "0");
  if (f.hasVehicles !== undefined) p.set("hasVehicles", f.hasVehicles ? "1" : "0");
  if (f.hasStructures !== undefined) p.set("hasStructures", f.hasStructures ? "1" : "0");
  if (f.hiddenGem !== undefined) p.set("hiddenGem", f.hiddenGem ? "1" : "0");
  if (f.minScore !== undefined) p.set("minScore", String(f.minScore));
  if (f.maxScore !== undefined) p.set("maxScore", String(f.maxScore));
  if (f.owner) p.set("owner", f.owner);
  if (f.q) p.set("q", f.q);
  if (f.sortBy && f.sortBy !== "recent") p.set("sortBy", f.sortBy);
  if (f.order && f.order !== "desc") p.set("order", f.order);
  if (f.cursor) p.set("cursor", f.cursor);
  if (f.limit !== undefined && f.limit !== 50) p.set("limit", String(f.limit));
  if (f.include instanceof Set) {
    const inc = Array.from(f.include);
    if (inc.length > 0) p.set("include", inc.join(","));
  }
  return p;
}

/**
 * Stable canonical JSON representation for cache keys. Uses sorted keys so
 * filter order doesn't change the hash.
 */
export function filtersCanonicalKey(f: UplandFilters): string {
  const obj = {
    city: [...(f.city ?? [])].sort(),
    state: f.state ?? null,
    country: f.country ?? null,
    neighborhood: f.neighborhood ?? null,
    minPrice: f.minPrice ?? null,
    maxPrice: f.maxPrice ?? null,
    minYield: f.minYield ?? null,
    maxYield: f.maxYield ?? null,
    minMarkup: f.minMarkup ?? null,
    maxMarkup: f.maxMarkup ?? null,
    forSale: f.forSale ?? null,
    hasVehicles: f.hasVehicles ?? null,
    hasStructures: f.hasStructures ?? null,
    hiddenGem: f.hiddenGem ?? null,
    minScore: f.minScore ?? null,
    maxScore: f.maxScore ?? null,
    owner: f.owner ?? null,
    q: f.q ?? null,
    sortBy: f.sortBy,
    order: f.order,
    cursor: f.cursor ?? null,
    limit: f.limit,
    include: Array.from(f.include ?? []).sort(),
  };
  return JSON.stringify(obj);
}
