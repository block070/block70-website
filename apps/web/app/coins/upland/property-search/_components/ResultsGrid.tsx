"use client";

import { useRouter, useSearchParams } from "next/navigation";

import type { PropertyListResponse, SortKey } from "@/lib/upland/types";
import {
  filtersToSearchParams,
  parseFiltersFromSearchParams,
  type UplandFilters,
} from "@/lib/upland/filters";
import { PropertyCard } from "./PropertyCard";

type Props = {
  data: PropertyListResponse;
  redactDealScore: boolean;
  canSortByScore: boolean;
};

const SORT_LABELS: Record<SortKey, string> = {
  recent: "Most recent",
  price: "Price",
  markup: "Markup",
  yield: "Yield / month",
  vehicles: "Vehicles",
  deal: "Deal Score",
};

export function ResultsGrid({ data, redactDealScore, canSortByScore }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const parsed = parseFiltersFromSearchParams(new URLSearchParams(searchParams.toString()));
  const filters: UplandFilters = parsed.ok
    ? parsed.filters
    : ({
        city: [],
        sortBy: "recent",
        order: "desc",
        limit: 50,
        include: new Set<string>(),
      } as unknown as UplandFilters);

  function update(patch: Partial<UplandFilters>) {
    const next = { ...filters, ...patch };
    const params = filtersToSearchParams(next);
    router.replace(`/coins/upland/property-search?${params.toString()}`, { scroll: false });
  }

  const hasResults = data.items.length > 0;

  return (
    <section>
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--b70-text-muted)]">
          <strong className="text-[var(--b70-text)]">{data.total.toLocaleString()}</strong>{" "}
          properties match
        </p>
        <div className="flex items-center gap-2">
          <label className="text-xs text-[var(--b70-text-muted)]" htmlFor="sort">
            Sort by
          </label>
          <select
            id="sort"
            value={filters.sortBy ?? "recent"}
            onChange={(e) =>
              update({ sortBy: e.target.value as SortKey, cursor: undefined })
            }
            className="rounded border border-[var(--b70-border)] bg-[var(--b70-bg)] px-2 py-1 text-sm text-[var(--b70-text)]"
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => {
              const disabled = key === "deal" && !canSortByScore;
              return (
                <option key={key} value={key} disabled={disabled}>
                  {SORT_LABELS[key]}
                  {disabled ? " · Pro" : ""}
                </option>
              );
            })}
          </select>
          <select
            value={filters.order ?? "desc"}
            onChange={(e) =>
              update({ order: e.target.value as "asc" | "desc", cursor: undefined })
            }
            className="rounded border border-[var(--b70-border)] bg-[var(--b70-bg)] px-2 py-1 text-sm text-[var(--b70-text)]"
          >
            <option value="desc">Desc</option>
            <option value="asc">Asc</option>
          </select>
        </div>
      </header>

      {data.freeTierCap && (
        <div className="mb-4 rounded-md border border-[var(--b70-crypto-blue)]/40 bg-[var(--b70-crypto-blue)]/10 px-4 py-2 text-sm text-[var(--b70-text)]">
          <strong className="text-[var(--b70-crypto-blue)]">Free-tier cap:</strong>{" "}
          {data.freeTierCap.message}{" "}
          <a
            href={data.freeTierCap.upsellUrl}
            className="font-semibold text-[var(--b70-crypto-blue)] hover:underline"
          >
            Upgrade →
          </a>
        </div>
      )}

      {!hasResults ? (
        <div className="rounded-lg border border-dashed border-[var(--b70-border)] bg-[var(--b70-surface)] p-12 text-center">
          <p className="text-sm text-[var(--b70-text-muted)]">
            No properties match your filters. Try widening the price range or clearing the city filter.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {data.items.map((p) => (
            <PropertyCard key={p.id} property={p} redacted={redactDealScore} />
          ))}
        </div>
      )}

      {data.nextCursor && (
        <div className="mt-6 flex justify-center">
          <button
            onClick={() => update({ cursor: data.nextCursor ?? undefined })}
            className="rounded-md border border-[var(--b70-border)] bg-[var(--b70-surface)] px-4 py-2 text-sm font-medium text-[var(--b70-text)] transition hover:bg-[var(--b70-surface-alt)]"
          >
            Load more
          </button>
        </div>
      )}
    </section>
  );
}
