import { Suspense } from "react";
import Link from "next/link";

import { parseFiltersFromSearchParams } from "@/lib/upland/filters";
import { listProperties, listCities } from "@/lib/upland/queries";
import { redactForTier, resolveUplandContext } from "@/lib/upland/entitlements";
import type { PropertyDto, PropertyListResponse } from "@/lib/upland/types";

import { Filters } from "./_components/Filters";
import { ResultsGrid } from "./_components/ResultsGrid";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type PageProps = {
  searchParams: Record<string, string | string[] | undefined>;
};

function paramsToURLSearchParams(
  sp: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const out = new URLSearchParams();
  for (const [key, val] of Object.entries(sp)) {
    if (val == null) continue;
    if (Array.isArray(val)) {
      for (const v of val) out.append(key, v);
    } else {
      out.append(key, val);
    }
  }
  return out;
}

export default async function UplandPropertySearchPage({ searchParams }: PageProps) {
  const ctx = await resolveUplandContext();
  const parsed = parseFiltersFromSearchParams(paramsToURLSearchParams(searchParams));

  // If filter parsing failed, render an error card rather than 500-ing.
  if (!parsed.ok) {
    return (
      <div className="mx-auto max-w-7xl px-4 pt-8">
        <h1 className="text-2xl font-semibold text-[var(--b70-text)]">Upland Property Search</h1>
        <p className="mt-3 text-sm text-red-400">
          Invalid filter: {parsed.error}. <Link href="/coins/upland/property-search">Reset</Link>
        </p>
      </div>
    );
  }

  let filters = parsed.filters;

  // Server-side gate: free tier cannot filter by vehicles, narrow to no-op.
  let freeTierCap: PropertyListResponse["freeTierCap"];
  if (filters.hasVehicles === true && !ctx.features.has("upland_vehicle_filter")) {
    filters = { ...filters, hasVehicles: undefined };
    freeTierCap = {
      feature: "upland_vehicle_filter",
      message: "The vehicle filter is a Pro feature.",
      upsellUrl: "/coins/upland/pricing?upsell=upland_vehicle_filter",
    };
  }
  if (filters.hiddenGem === true && !ctx.features.has("upland_hidden_gems_feed")) {
    filters = { ...filters, hiddenGem: undefined };
    freeTierCap ??= {
      feature: "upland_hidden_gems_feed",
      message: "Hidden gems is a Pro feature.",
      upsellUrl: "/coins/upland/pricing?upsell=upland_hidden_gems_feed",
    };
  }
  if (filters.sortBy === "deal" && !ctx.features.has("upland_deal_score")) {
    filters = { ...filters, sortBy: "recent" };
    freeTierCap ??= {
      feature: "upland_deal_score",
      message: "Sorting by Deal Score requires Pro.",
      upsellUrl: "/coins/upland/pricing?upsell=upland_deal_score",
    };
  }

  // Clamp page size to the tier's cap.
  const maxLimit = ctx.limits.maxPageSize;
  if (filters.limit > maxLimit) {
    filters = { ...filters, limit: maxLimit };
  }

  const [raw, cities] = await Promise.all([
    listProperties(filters),
    listCities(),
  ]);

  const showDealScore = ctx.features.has("upland_deal_score");
  const redactedItems: PropertyDto[] = raw.items.map((p) =>
    showDealScore ? p : redactForTier(p, ctx.tier),
  );

  const data: PropertyListResponse = {
    ...raw,
    items: redactedItems,
    freeTierCap: freeTierCap ?? raw.freeTierCap,
  };

  const visibleCities = cities.slice(0, ctx.limits.maxCities);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3 border-b border-[var(--b70-border)] pb-4">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--b70-crypto-blue)]">
            Upland
          </p>
          <h1 className="mt-1 text-2xl font-semibold text-[var(--b70-text)] md:text-3xl">
            Property Search
          </h1>
          <p className="mt-1 max-w-2xl text-sm text-[var(--b70-text-muted)]">
            Search and filter properties across every Upland city. Pro tier unlocks the Deal Score, vehicle
            filter, and hidden-gem feed.
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-[var(--b70-text-muted)]">
          <span>
            Tier: <strong className="text-[var(--b70-text)]">{ctx.tier}</strong>
          </span>
          <Link
            href="/coins/upland/pricing"
            className="rounded border border-[var(--b70-crypto-blue)]/40 bg-[var(--b70-crypto-blue)]/10 px-3 py-1 font-medium text-[var(--b70-crypto-blue)]"
          >
            {ctx.tier === "free" ? "Upgrade" : "Manage plan"}
          </Link>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-[260px,1fr]">
        <Suspense fallback={<div className="h-96 animate-pulse rounded bg-[var(--b70-surface)]" />}>
          <Filters
            cities={visibleCities}
            tier={ctx.tier}
            features={Array.from(ctx.features)}
          />
        </Suspense>
        <Suspense fallback={<div className="h-96 animate-pulse rounded bg-[var(--b70-surface)]" />}>
          <ResultsGrid
            data={data}
            redactDealScore={!showDealScore}
            canSortByScore={showDealScore}
          />
        </Suspense>
      </div>
    </div>
  );
}
