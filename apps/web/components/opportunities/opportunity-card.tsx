import Link from "next/link";
import type { Opportunity } from "@/lib/types";
import { SaveToWatchlist } from "@/components/opportunities/save-to-watchlist";

type Props = {
  opportunity: Opportunity;
  href: string;
};

function formatScore(score: number | null | undefined, digits = 0): string {
  if (score == null || Number.isNaN(score)) return "–";
  return `${(score * 100).toFixed(digits)}%`;
}

function formatCurrency(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "–";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatPercentMaybe(value: number | null | undefined, digits = 1) {
  if (value == null || Number.isNaN(value)) return "–";
  return `${value.toFixed(digits)}%`;
}

function deriveBadges(opportunity: Opportunity): string[] {
  const badges: string[] = [];

  if (opportunity.total_score >= 0.85) {
    badges.push("High Score");
  }

  if (opportunity.detected_at) {
    const detected = new Date(opportunity.detected_at);
    const now = new Date();
    const ageMinutes = (now.getTime() - detected.getTime()) / 60000;
    if (!Number.isNaN(ageMinutes) && ageMinutes >= 0 && ageMinutes <= 60) {
      badges.push("New Opportunity");
    }
  }

  if (opportunity.estimated_roi_percent != null && !Number.isNaN(opportunity.estimated_roi_percent)) {
    if (opportunity.estimated_roi_percent >= 80) {
      badges.push("High ROI");
    }
  }

  if (opportunity.type === "wallet") {
    badges.push("Whale Activity");
  }

  if (opportunity.type === "project_discovery" || opportunity.source === "Opportunity Hunter") {
    badges.push("Early Opportunity");
  }

  return badges;
}

export function OpportunityCard({ opportunity, href }: Props) {
  const {
    title,
    type,
    chain,
    total_score,
    estimated_roi_percent,
    estimated_cost,
    risk_level,
    difficulty_level,
    freshness_score,
    summary,
    source,
    detected_at,
  } = opportunity;

  const strengthLabel =
    total_score >= 0.8 ? "High conviction" : total_score >= 0.6 ? "Strong" : "Watchlist";

  const typeLabel =
    type === "arbitrage"
      ? "Arbitrage"
      : type === "mining"
        ? "Miner ROI"
        : type === "wallet"
          ? "Wallet activity"
          : type;

  const badges = deriveBadges(opportunity);

  return (
    <article className="relative overflow-hidden rounded-xl border border-slate-800 bg-slate-950/80 p-4 shadow-lg shadow-black/40 transition hover:border-emerald-500/60 hover:shadow-emerald-500/20">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-200">
              {typeLabel}
            </span>
            {chain ? (
              <span className="rounded-full border border-slate-800 bg-slate-900/80 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                {chain}
              </span>
            ) : null}
            {source ? (
              <span className="text-[10px] uppercase tracking-wide text-emerald-300">
                {source}
              </span>
            ) : null}
            {badges.map((badge) => (
              <span
                key={badge}
                className="rounded-full border border-emerald-600/60 bg-emerald-600/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300"
              >
                {badge}
              </span>
            ))}
          </div>
          <h3 className="text-sm font-semibold text-slate-50 line-clamp-2">
            {title}
          </h3>
          {summary ? (
            <p className="text-xs text-slate-400 line-clamp-3">{summary}</p>
          ) : null}
        </div>

        <div className="flex flex-col items-end gap-2">
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wide text-slate-400">
              Total Score
            </p>
            <p className="text-lg font-semibold text-emerald-400">
              {formatScore(total_score, 0)}
            </p>
            <p className="mt-0.5 text-[10px] text-emerald-300">{strengthLabel}</p>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] text-slate-400">
            <div>
              <span className="text-slate-500">Est. ROI</span>{" "}
              <span className="font-medium">
                {formatPercentMaybe(estimated_roi_percent)}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Cost</span>{" "}
              <span className="font-medium">{formatCurrency(estimated_cost)}</span>
            </div>
            <div>
              <span className="text-slate-500">Risk</span>{" "}
              <span className="font-medium capitalize">
                {risk_level ?? "n/a"}
              </span>
            </div>
            <div>
              <span className="text-slate-500">Freshness</span>{" "}
              <span className="font-medium">
                {formatScore(freshness_score ?? null, 0)}
              </span>
            </div>
          </div>
          <div className="flex gap-1 text-[10px] text-slate-300">
            {difficulty_level && (
              <span className="rounded-full border border-slate-800 bg-slate-900 px-2 py-0.5">
                Difficulty:{" "}
                <span className="font-semibold capitalize">
                  {difficulty_level}
                </span>
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between text-[11px] text-slate-400">
        <div className="flex flex-col gap-1">
          <p>
            Detected: <span className="font-medium">{formatDate(detected_at)}</span>
          </p>
          <SaveToWatchlist opportunity={opportunity} />
        </div>
        <Link
          href={href}
          className="rounded-full border border-emerald-500/60 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-300 hover:bg-emerald-500/20"
        >
          View details
        </Link>
      </div>

      <div className="pointer-events-none absolute -right-12 -top-16 h-28 w-28 rounded-full bg-emerald-500/10 blur-3xl" />
    </article>
  );
}

