"use client";

import { Lock } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, useEffect } from "react";

import { filtersToSearchParams, parseFiltersFromSearchParams, type UplandFilters } from "@/lib/upland/filters";
import type { CityFacet } from "@/lib/upland/types";

type Props = {
  cities: CityFacet[];
  tier: "free" | "pro" | "elite";
  features: string[];
};

function toURLSearchParams(params: ReadonlyURLSearchParams | URLSearchParams): URLSearchParams {
  return new URLSearchParams(params.toString());
}

type ReadonlyURLSearchParams = ReturnType<typeof useSearchParams>;

export function Filters({ cities, tier, features }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const filters: UplandFilters | null = useMemo(() => {
    const parsed = parseFiltersFromSearchParams(toURLSearchParams(searchParams));
    return parsed.ok ? parsed.filters : null;
  }, [searchParams]);

  const current = filters ?? ({
    city: [],
    sortBy: "recent",
    order: "desc",
    limit: 50,
    include: new Set<string>(),
  } as unknown as UplandFilters);

  const [q, setQ] = useState(current.q ?? "");
  useEffect(() => {
    setQ(current.q ?? "");
  }, [current.q]);

  useEffect(() => {
    const handle = setTimeout(() => {
      if ((q || "") === (current.q ?? "")) return;
      apply({ q: q.trim() || undefined, cursor: undefined });
    }, 300);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function apply(patch: Partial<UplandFilters>) {
    const next = { ...current, ...patch };
    const params = filtersToSearchParams(next);
    router.replace(`/coins/upland/property-search?${params.toString()}`, { scroll: false });
  }

  const canVehicleFilter = features.includes("upland_vehicle_filter");
  const canAdvanced = features.includes("upland_advanced_filters");
  const selectedCity = current.city?.[0] ?? "";

  return (
    <aside className="sticky top-4 space-y-4 self-start rounded-lg border border-[var(--b70-border)] bg-[var(--b70-surface)] p-4">
      <label className="block">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--b70-text-muted)]">
          Search
        </span>
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Address, owner…"
          className="mt-1 w-full rounded border border-[var(--b70-border)] bg-[var(--b70-bg)] px-2 py-1.5 text-sm text-[var(--b70-text)] outline-none focus:border-[var(--b70-crypto-blue)]"
        />
      </label>

      <label className="block">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--b70-text-muted)]">
          City
        </span>
        <select
          value={selectedCity}
          onChange={(e) =>
            apply({ city: e.target.value ? [e.target.value] : [], cursor: undefined })
          }
          className="mt-1 w-full rounded border border-[var(--b70-border)] bg-[var(--b70-bg)] px-2 py-1.5 text-sm text-[var(--b70-text)] outline-none"
        >
          <option value="">All cities</option>
          {cities.map((c) => (
            <option key={c.city} value={c.city}>
              {c.city} ({c.propertyCount})
            </option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={current.forSale === true}
          onChange={(e) =>
            apply({ forSale: e.target.checked ? true : undefined, cursor: undefined })
          }
        />
        <span className="text-sm text-[var(--b70-text)]">For sale only</span>
      </label>

      <label className={`flex items-center gap-2 ${!canVehicleFilter ? "opacity-60" : ""}`}>
        <input
          type="checkbox"
          disabled={!canVehicleFilter}
          checked={current.hasVehicles === true}
          onChange={(e) =>
            apply({ hasVehicles: e.target.checked ? true : undefined, cursor: undefined })
          }
        />
        <span className="flex items-center gap-1 text-sm text-[var(--b70-text)]">
          Has vehicle
          {!canVehicleFilter && (
            <a
              href="/coins/upland/pricing?upsell=upland_vehicle_filter"
              className="flex items-center gap-0.5 text-[10px] uppercase tracking-wide text-[var(--b70-crypto-blue)]"
            >
              <Lock className="h-3 w-3" /> Pro
            </a>
          )}
        </span>
      </label>

      <label className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={current.hasStructures === true}
          onChange={(e) =>
            apply({ hasStructures: e.target.checked ? true : undefined, cursor: undefined })
          }
        />
        <span className="text-sm text-[var(--b70-text)]">Has structure</span>
      </label>

      <div className={canAdvanced ? "" : "opacity-60"}>
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--b70-text-muted)]">
            Advanced
          </span>
          {!canAdvanced && (
            <a
              href="/coins/upland/pricing?upsell=upland_advanced_filters"
              className="flex items-center gap-0.5 text-[10px] uppercase tracking-wide text-[var(--b70-crypto-blue)]"
            >
              <Lock className="h-3 w-3" /> Pro
            </a>
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            min={0}
            placeholder="Min $"
            disabled={!canAdvanced}
            defaultValue={current.minPrice ?? ""}
            onBlur={(e) =>
              apply({
                minPrice: e.target.value ? Number(e.target.value) : undefined,
                cursor: undefined,
              })
            }
            className="rounded border border-[var(--b70-border)] bg-[var(--b70-bg)] px-2 py-1 text-sm text-[var(--b70-text)]"
          />
          <input
            type="number"
            min={0}
            placeholder="Max $"
            disabled={!canAdvanced}
            defaultValue={current.maxPrice ?? ""}
            onBlur={(e) =>
              apply({
                maxPrice: e.target.value ? Number(e.target.value) : undefined,
                cursor: undefined,
              })
            }
            className="rounded border border-[var(--b70-border)] bg-[var(--b70-bg)] px-2 py-1 text-sm text-[var(--b70-text)]"
          />
          <input
            type="number"
            step="0.1"
            placeholder="Min yield"
            disabled={!canAdvanced}
            defaultValue={current.minYield ?? ""}
            onBlur={(e) =>
              apply({
                minYield: e.target.value ? Number(e.target.value) : undefined,
                cursor: undefined,
              })
            }
            className="rounded border border-[var(--b70-border)] bg-[var(--b70-bg)] px-2 py-1 text-sm text-[var(--b70-text)]"
          />
          <input
            type="number"
            step="1"
            placeholder="Max markup %"
            disabled={!canAdvanced}
            defaultValue={current.maxMarkup ?? ""}
            onBlur={(e) =>
              apply({
                maxMarkup: e.target.value ? Number(e.target.value) : undefined,
                cursor: undefined,
              })
            }
            className="rounded border border-[var(--b70-border)] bg-[var(--b70-bg)] px-2 py-1 text-sm text-[var(--b70-text)]"
          />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-[var(--b70-border)] pt-3">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-[var(--b70-text-muted)]">
          Tier · {tier}
        </span>
        {tier === "free" && (
          <a
            href="/coins/upland/pricing"
            className="text-xs font-medium text-[var(--b70-crypto-blue)]"
          >
            Upgrade →
          </a>
        )}
      </div>
    </aside>
  );
}
