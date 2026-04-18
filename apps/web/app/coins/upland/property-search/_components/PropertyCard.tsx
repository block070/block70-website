import { Car, Home, MapPin, Star, Zap } from "lucide-react";
import type { PropertyDto } from "@/lib/upland/types";

type Props = {
  property: PropertyDto;
  /** When true, deal-score related UI is hidden (Free tier). */
  redacted: boolean;
};

function fmtCurrency(n: number | null): string {
  if (n == null) return "—";
  return `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

export function PropertyCard({ property, redacted }: Props) {
  const score = !redacted && property.dealScore != null ? property.dealScore : null;
  return (
    <a
      href={`/coins/upland/property-search/${property.id}`}
      className="group relative flex flex-col justify-between rounded-lg border border-[var(--b70-border)] bg-[var(--b70-surface)] p-4 transition hover:border-[var(--b70-crypto-blue)]"
    >
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="truncate text-sm font-semibold text-[var(--b70-text)]">
              {property.address}
            </h3>
            <p className="mt-1 flex items-center gap-1 text-xs text-[var(--b70-text-muted)]">
              <MapPin className="h-3 w-3" />
              {property.city}
              {property.neighborhood ? ` · ${property.neighborhood}` : null}
            </p>
          </div>
          {score !== null && (
            <div
              className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${
                score >= 80
                  ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-400"
                  : score >= 60
                    ? "border-yellow-500/50 bg-yellow-500/10 text-yellow-400"
                    : "border-[var(--b70-border)] bg-[var(--b70-surface-alt)] text-[var(--b70-text-muted)]"
              }`}
              title="Deal Score (higher = better)"
            >
              {score.toFixed(0)}
            </div>
          )}
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-[var(--b70-text-muted)]">
          <div>
            <div className="text-[10px] uppercase tracking-wide">Price</div>
            <div className="text-sm font-medium text-[var(--b70-text)]">
              {fmtCurrency(property.price)}
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wide">Mint</div>
            <div className="text-sm font-medium text-[var(--b70-text)]">
              {fmtCurrency(property.mintPrice)}
            </div>
          </div>
          {!redacted && (
            <>
              <div>
                <div className="text-[10px] uppercase tracking-wide">Markup</div>
                <div className="text-sm font-medium text-[var(--b70-text)]">
                  {property.markupPercentage != null
                    ? `${property.markupPercentage.toFixed(1)}%`
                    : "—"}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wide">Yield / mo</div>
                <div className="text-sm font-medium text-[var(--b70-text)]">
                  {fmtCurrency(property.yieldPerMonth)}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {property.forSale ? (
          <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-emerald-400">
            For sale
          </span>
        ) : (
          <span className="rounded-full border border-[var(--b70-border)] bg-[var(--b70-surface-alt)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--b70-text-muted)]">
            Held
          </span>
        )}
        {property.hasVehicle && (
          <span className="flex items-center gap-1 rounded-full border border-[var(--b70-crypto-blue)]/40 bg-[var(--b70-crypto-blue)]/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--b70-crypto-blue)]">
            <Car className="h-3 w-3" />
            Vehicle{property.vehicleCount > 1 ? ` ×${property.vehicleCount}` : ""}
          </span>
        )}
        {property.hasStructure && (
          <span className="flex items-center gap-1 rounded-full border border-[var(--b70-border)] bg-[var(--b70-surface-alt)] px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-[var(--b70-text-muted)]">
            <Home className="h-3 w-3" />
            {property.structureType ?? "Structure"}
          </span>
        )}
        {!redacted && property.isHiddenGem && (
          <span className="flex items-center gap-1 rounded-full border border-pink-500/40 bg-pink-500/10 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-pink-400">
            <Star className="h-3 w-3" />
            Hidden gem
          </span>
        )}
      </div>
      {redacted && (
        <div className="pointer-events-none absolute right-2 top-2 text-[10px] text-[var(--b70-text-muted)] opacity-80">
          <Zap className="inline h-3 w-3" /> Pro unlocks score
        </div>
      )}
    </a>
  );
}
