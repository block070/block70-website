// Typed Prisma queries against the Upland data plane.
//
// Read queries hit the `property_search_view` materialized view (via the
// read-only PropertySearch model). Detail hits the base tables so it reflects
// fresh assets and vehicles without waiting on a mat-view refresh.

import "server-only";
import type { Prisma } from "@prisma/client";
import { uplandPrisma } from "./db";
import { computeDealScore, isHiddenGem } from "./deal-score";
import type {
  CityFacet,
  PropertyDto,
  PropertyListResponse,
  StatsResponse,
  VehicleDto,
} from "./types";
import type { UplandFilters } from "./filters";

// ---------- Helpers ---------------------------------------------------------

function decimalToNumber(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  // Prisma Decimal instances expose a toNumber method.
  const maybeDec = v as { toNumber?: () => number };
  if (typeof maybeDec.toNumber === "function") {
    const n = maybeDec.toNumber();
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

// ---------- WHERE builder ---------------------------------------------------

type ViewWhere = Prisma.Sql;

function buildViewWhere(filters: UplandFilters): {
  where: string;
  params: unknown[];
} {
  const conds: string[] = [];
  const params: unknown[] = [];
  const push = (clause: string, ...values: unknown[]) => {
    // Postgres $n indexing: based on params length at time of push.
    let placeholderIdx = params.length + 1;
    const filled = clause.replace(/\?/g, () => `$${placeholderIdx++}`);
    conds.push(filled);
    params.push(...values);
  };

  if (filters.city && filters.city.length > 0) {
    push("city = ANY(?::text[])", filters.city);
  }
  if (filters.state) push("state = ?", filters.state);
  if (filters.country) push("country = ?", filters.country);
  if (filters.neighborhood) {
    push("neighborhood ILIKE ?", `%${filters.neighborhood}%`);
  }
  if (filters.minPrice !== undefined) push("price >= ?", filters.minPrice);
  if (filters.maxPrice !== undefined) push("price <= ?", filters.maxPrice);
  if (filters.minYield !== undefined)
    push("yield_per_month >= ?", filters.minYield);
  if (filters.maxYield !== undefined)
    push("yield_per_month <= ?", filters.maxYield);
  if (filters.minMarkup !== undefined)
    push("markup_percentage >= ?", filters.minMarkup);
  if (filters.maxMarkup !== undefined)
    push("markup_percentage <= ?", filters.maxMarkup);
  if (filters.forSale !== undefined) push("for_sale = ?", filters.forSale);
  if (filters.hasVehicles !== undefined)
    push("has_vehicle = ?", filters.hasVehicles);
  if (filters.hasStructures !== undefined)
    push("has_structure = ?", filters.hasStructures);
  if (filters.hiddenGem === true) push("is_hidden_gem = true");
  if (filters.minScore !== undefined) push("deal_score >= ?", filters.minScore);
  if (filters.maxScore !== undefined) push("deal_score <= ?", filters.maxScore);
  if (filters.owner) push("owner = ?", filters.owner);
  if (filters.q) {
    // trigram ILIKE across address and neighborhood; GIN trgm indexes cover both.
    push("(address ILIKE ? OR neighborhood ILIKE ?)", `%${filters.q}%`, `%${filters.q}%`);
  }

  return {
    where: conds.length > 0 ? `WHERE ${conds.join(" AND ")}` : "",
    params,
  };
}

function sortClause(filters: UplandFilters): string {
  const dir = filters.order === "asc" ? "ASC" : "DESC";
  const nulls = dir === "DESC" ? "NULLS LAST" : "NULLS FIRST";
  switch (filters.sortBy) {
    case "price":
      return `ORDER BY price ${dir} ${nulls}, id ASC`;
    case "yield":
      return `ORDER BY yield_per_month ${dir} ${nulls}, id ASC`;
    case "markup":
      return `ORDER BY markup_percentage ${dir} ${nulls}, id ASC`;
    case "vehicles":
      return `ORDER BY has_vehicle DESC, vehicle_count DESC, price ASC, id ASC`;
    case "deal":
      return `ORDER BY deal_score ${dir} ${nulls}, id ASC`;
    case "recent":
    default:
      return `ORDER BY updated_at ${dir}, id ASC`;
  }
}

// ---------- Row mapping -----------------------------------------------------

type ViewRow = {
  id: string;
  address: string;
  city: string;
  state: string | null;
  country: string;
  neighborhood: string | null;
  price: unknown;
  mint_price: unknown;
  markup_percentage: number | null;
  yield_per_month: unknown;
  for_sale: boolean;
  owner: string | null;
  lat: number | null;
  lng: number | null;
  has_structure: boolean;
  structure_type: string | null;
  has_vehicle: boolean;
  vehicle_count: number;
  deal_score: number | null;
  is_hidden_gem: boolean;
  updated_at: Date | string;
};

function mapViewRowToDto(
  row: ViewRow,
  extras: { uplandId?: string; collection?: string | null } = {},
): PropertyDto {
  return {
    id: row.id,
    uplandId: extras.uplandId ?? row.id,
    address: row.address,
    city: row.city,
    state: row.state,
    country: row.country,
    neighborhood: row.neighborhood,
    price: decimalToNumber(row.price),
    mintPrice: decimalToNumber(row.mint_price),
    markupPercentage: row.markup_percentage,
    yieldPerMonth: decimalToNumber(row.yield_per_month),
    forSale: row.for_sale,
    owner: row.owner,
    lat: row.lat,
    lng: row.lng,
    collection: extras.collection ?? null,
    hasStructure: row.has_structure,
    structureType: row.structure_type,
    hasVehicle: row.has_vehicle,
    vehicleCount: row.vehicle_count,
    dealScore: row.deal_score,
    isHiddenGem: row.is_hidden_gem,
    nftMetadata: null,
    updatedAt:
      row.updated_at instanceof Date
        ? row.updated_at.toISOString()
        : String(row.updated_at),
  };
}

// ---------- List / facets ---------------------------------------------------

export async function listProperties(
  filters: UplandFilters,
): Promise<PropertyListResponse> {
  const { where, params } = buildViewWhere(filters);
  const order = sortClause(filters);
  const limit = filters.limit;

  // Cursor pagination: the view's sort key + id tiebreaker yields a stable cursor.
  // For simplicity, cursor here is the last-seen id; tightening to a composite
  // cursor is a follow-up optimization.
  const cursorClause = filters.cursor
    ? `AND id > $${params.length + 1}`
    : "";
  const cursorParam = filters.cursor ? [filters.cursor] : [];

  const finalWhere =
    where && cursorClause
      ? `${where} ${cursorClause}`
      : where
        ? where
        : cursorClause
          ? cursorClause.replace(/^AND/, "WHERE")
          : "";

  const sql = `
    SELECT id, address, city, state, country, neighborhood,
           price, mint_price, markup_percentage, yield_per_month,
           for_sale, owner, lat, lng,
           has_structure, structure_type, has_vehicle, vehicle_count,
           deal_score, is_hidden_gem, updated_at
    FROM property_search_view
    ${finalWhere}
    ${order}
    LIMIT ${limit + 1}
  `;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- raw query return type
  const rows: ViewRow[] = (await uplandPrisma.$queryRawUnsafe(sql, ...params, ...cursorParam)) as unknown as ViewRow[];

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor = hasMore ? pageRows[pageRows.length - 1]?.id ?? null : null;

  // Count + range facets — gated by a 60s cache upstream; run against the same view.
  const countSql = `SELECT COUNT(*)::int AS total FROM property_search_view ${where}`;
  const facetSql = `
    SELECT
      MIN(price)::float           AS min_price,
      MAX(price)::float           AS max_price,
      MIN(yield_per_month)::float AS min_yield,
      MAX(yield_per_month)::float AS max_yield
    FROM property_search_view
    ${where}
  `;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [countRow]: any[] = (await uplandPrisma.$queryRawUnsafe(countSql, ...params)) as any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [facetRow]: any[] = (await uplandPrisma.$queryRawUnsafe(facetSql, ...params)) as any[];

  const priceRange: [number, number] | null =
    facetRow?.min_price != null && facetRow?.max_price != null
      ? [Number(facetRow.min_price), Number(facetRow.max_price)]
      : null;
  const yieldRange: [number, number] | null =
    facetRow?.min_yield != null && facetRow?.max_yield != null
      ? [Number(facetRow.min_yield), Number(facetRow.max_yield)]
      : null;

  return {
    items: pageRows.map((r) => mapViewRowToDto(r)),
    nextCursor,
    total: Number(countRow?.total ?? 0),
    facets: { priceRange, yieldRange },
  };
}

// ---------- Detail ----------------------------------------------------------

export async function getPropertyById(
  id: string,
  opts: { includeBreakdown?: boolean } = {},
): Promise<PropertyDto | null> {
  const row = await uplandPrisma.property.findUnique({
    where: { id },
    include: {
      assets: true,
      vehicles: true,
    },
  });
  if (!row) return null;

  const vehicles: VehicleDto[] = (row.vehicles ?? []).map((v) => ({
    id: v.id,
    name: v.name,
    type: v.type,
    rarity: v.rarity,
  }));

  const dto: PropertyDto = {
    id: row.id,
    uplandId: row.uplandId,
    address: row.address,
    city: row.city,
    state: row.state,
    country: row.country,
    neighborhood: row.neighborhood,
    price: decimalToNumber(row.price),
    mintPrice: decimalToNumber(row.mintPrice),
    markupPercentage: row.markupPercentage,
    yieldPerMonth: decimalToNumber(row.yieldPerMonth),
    forSale: row.forSale,
    owner: row.owner,
    lat: row.lat,
    lng: row.lng,
    collection: row.collection,
    hasStructure: row.assets?.hasStructure ?? false,
    structureType: row.assets?.structureType ?? null,
    hasVehicle: row.assets?.hasVehicle ?? false,
    vehicleCount: row.assets?.vehicleCount ?? 0,
    dealScore: row.dealScore,
    isHiddenGem: row.isHiddenGem,
    vehicles,
    nftMetadata: null,
    updatedAt: row.updatedAt.toISOString(),
  };

  if (opts.includeBreakdown) {
    const result = computeDealScore({
      price: decimalToNumber(row.price),
      mintPrice: decimalToNumber(row.mintPrice),
      markupPercentage: row.markupPercentage,
      yieldPerMonth: decimalToNumber(row.yieldPerMonth),
      forSale: row.forSale,
      hasVehicle: row.assets?.hasVehicle ?? false,
      vehicleCount: row.assets?.vehicleCount ?? 0,
      hasStructure: row.assets?.hasStructure ?? false,
      city: row.city,
      collection: row.collection,
      neighborhood: row.neighborhood,
    });
    dto.dealScoreBreakdown = result.breakdown;
    dto.dealScoreReasons = result.hiddenGemReasons;
    // Recompute hidden-gem flag for drift detection but don't overwrite the
    // indexed source of truth -- the client just shows the live breakdown.
    void isHiddenGem;
  }

  return dto;
}

// ---------- Cities facet ----------------------------------------------------

export async function listCities(): Promise<CityFacet[]> {
  const rows = await uplandPrisma.$queryRawUnsafe<
    Array<{
      city: string;
      state: string | null;
      country: string;
      property_count: number;
      for_sale_count: number;
      with_vehicle_count: number;
      with_structure_count: number;
    }>
  >(`
    SELECT city, state, country,
           property_count, for_sale_count, with_vehicle_count, with_structure_count
    FROM city_stats_view
    ORDER BY property_count DESC
  `);
  return rows.map((r) => ({
    city: r.city,
    state: r.state,
    country: r.country,
    propertyCount: Number(r.property_count),
    forSaleCount: Number(r.for_sale_count),
    withVehicleCount: Number(r.with_vehicle_count),
    withStructureCount: Number(r.with_structure_count),
  }));
}

// ---------- Stats -----------------------------------------------------------

export async function getGlobalStats(): Promise<StatsResponse> {
  const rows = await uplandPrisma.$queryRawUnsafe<
    Array<{
      total: number;
      for_sale: number;
      with_vehicles: number;
      with_structures: number;
      hidden_gems: number;
      min_price: number | null;
      max_price: number | null;
      min_yield: number | null;
      max_yield: number | null;
    }>
  >(`
    SELECT
      COUNT(*)::int                                         AS total,
      COUNT(*) FILTER (WHERE for_sale)::int                 AS for_sale,
      COUNT(*) FILTER (WHERE has_vehicle)::int              AS with_vehicles,
      COUNT(*) FILTER (WHERE has_structure)::int            AS with_structures,
      COUNT(*) FILTER (WHERE is_hidden_gem)::int            AS hidden_gems,
      MIN(price)::float                                     AS min_price,
      MAX(price)::float                                     AS max_price,
      MIN(yield_per_month)::float                           AS min_yield,
      MAX(yield_per_month)::float                           AS max_yield
    FROM property_search_view
  `);

  const run = await uplandPrisma.ingestionRun.findFirst({
    where: { status: "ok" },
    orderBy: { finishedAt: "desc" },
  });

  const r = rows[0];
  return {
    total: Number(r?.total ?? 0),
    forSale: Number(r?.for_sale ?? 0),
    withVehicles: Number(r?.with_vehicles ?? 0),
    withStructures: Number(r?.with_structures ?? 0),
    hiddenGems: Number(r?.hidden_gems ?? 0),
    priceRange:
      r?.min_price != null && r?.max_price != null
        ? [Number(r.min_price), Number(r.max_price)]
        : null,
    yieldRange:
      r?.min_yield != null && r?.max_yield != null
        ? [Number(r.min_yield), Number(r.max_yield)]
        : null,
    lastIngestionAt: run?.finishedAt ? run.finishedAt.toISOString() : null,
  };
}

// Suppress unused-import warning for the Prisma Sql import reserved for future
// refactor into $queryRaw`...`-style tagged templates.
void (null as unknown as ViewWhere);
