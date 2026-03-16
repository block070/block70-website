import type { Metadata } from "next";
import Link from "next/link";

import { getOpportunities, getOpportunityBySlug, getOpportunityById } from "@/lib/api";
import type { Opportunity } from "@/lib/types";
import {
  OpportunityTimeline,
  ScoreBreakdown,
  ShareCardButton,
  AiAnalysis,
  ResearchReport,
  TradeSimulation,
  TradeFeasibility,
} from "@/components/opportunities";

type OpportunityDetailProps = {
  params: { slug: string };
};

function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "–";
  return `${value.toFixed(digits)}%`;
}

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

export async function generateMetadata({
  params,
}: OpportunityDetailProps): Promise<Metadata> {
  try {
    const opportunity = await getOpportunityBySlug(params.slug);
    return {
      title: `${opportunity.title} · Block70 Opportunity`,
      description:
        opportunity.summary ??
        "Research-grade crypto opportunity surfaced by the Block70 Alpha Network.",
      openGraph: {
        title: `${opportunity.title} · Block70 Opportunity`,
        description:
          opportunity.summary ??
          "Research-grade crypto opportunity surfaced by the Block70 Alpha Network.",
        type: "article",
      },
      twitter: {
        card: "summary_large_image",
        title: `${opportunity.title} · Block70 Opportunity`,
        description:
          opportunity.summary ??
          "Research-grade crypto opportunity surfaced by the Block70 Alpha Network.",
      },
    };
  } catch {
    return {
      title: "Opportunity · Block70",
      description:
        "Research-grade crypto opportunity surfaced by the Block70 Alpha Network.",
    };
  }
}

export default async function OpportunityDetailPage({
  params,
}: OpportunityDetailProps) {
  const slug = params.slug;

  let opportunity: Opportunity | null = null;
  let related: Opportunity[] = [];
  let error: string | null = null;

  try {
    const numericId = /^\d+$/.test(slug) ? Number(slug) : null;
    opportunity = numericId != null
      ? await getOpportunityById(numericId)
      : await getOpportunityBySlug(slug);
    try {
      const all = await getOpportunities();
      related =
        opportunity != null
          ? all
              .filter(
                (op) =>
                  op.id !== opportunity!.id &&
                  op.type === opportunity!.type &&
                  op.asset_symbol === opportunity!.asset_symbol,
              )
              .sort((a, b) => b.total_score - a.total_score)
              .slice(0, 3)
          : [];
    } catch {
      related = [];
    }
  } catch (e) {
    error =
      "Unable to load this opportunity from the backend right now. Please try again shortly.";
  }

  if (!opportunity) {
    return (
      <div className="space-y-4">
        <header className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-50">
            Opportunity
          </h2>
          <Link
            href="/opportunities"
            className="text-xs font-medium text-slate-300 underline underline-offset-4"
          >
            Back to opportunities
          </Link>
        </header>
        <section className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-4 text-sm text-rose-100">
          {error ??
            "Opportunity not found. It may have expired or been removed."}
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-50">
            {opportunity.title}
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            {opportunity.type} · {opportunity.chain ?? "multi-chain"} ·{" "}
            <span className="capitalize">{opportunity.status}</span>
          </p>
          <p className="mt-1 text-[11px] text-slate-500">
            {opportunity.type === "arbitrage"
              ? "DEX pricing gap opportunity."
              : opportunity.type === "mining"
                ? "Miner ROI and hardware payoff profile."
                : opportunity.type === "wallet"
                  ? "Smart wallet behavior and follow trade."
                  : "Normalized opportunity scored across multiple dimensions."}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <ShareCardButton opportunity={opportunity} />
          <Link
            href="/opportunities"
            className="text-xs font-medium text-slate-300 underline underline-offset-4"
          >
            Back to opportunities
          </Link>
        </div>
      </header>

      {/* Reuse the same sections as the ID-based page to keep it report-like */}
      <section className="grid gap-4 md:grid-cols-[2.2fr,1.3fr]">
        <div className="space-y-4 rounded-xl border border-slate-800 bg-slate-900/60 p-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-50">
              Opportunity Thesis
            </h3>
            {opportunity.thesis ? (
              <p className="mt-2 text-sm text-slate-300">
                {opportunity.thesis}
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-500">
                Thesis has not been documented yet. Treat this as a raw signal;
                Block70 will eventually explain why this looks like &quot;easy
                money&quot; compared to other trades on your radar.
              </p>
            )}
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-50">
              Supporting Signals
            </h3>
            <ul className="mt-2 space-y-1.5 text-sm text-slate-300">
              <li>
                <span className="text-slate-400">Score profile:</span>{" "}
                <span className="font-medium text-emerald-300">
                  {formatScore(opportunity.total_score, 0)} total
                </span>{" "}
                with{" "}
                <span className="text-slate-200">
                  {formatScore(opportunity.upside_score, 0)} upside /
                  {formatScore(opportunity.confidence_score, 0)} confidence /
                  {formatScore(opportunity.liquidity_score, 0)} liquidity.
                </span>
              </li>
              {opportunity.estimated_roi_percent != null && (
                <li>
                  <span className="text-slate-400">Economics:</span>{" "}
                  <span className="text-slate-200">
                    Est. ROI{" "}
                    <span className="font-medium">
                      {formatPercent(opportunity.estimated_roi_percent)}
                    </span>{" "}
                    with est. upside{" "}
                    <span className="font-medium">
                      {formatPercent(opportunity.estimated_upside)}
                    </span>{" "}
                    and cost envelope{" "}
                    <span className="font-medium">
                      {formatCurrency(opportunity.estimated_cost)}
                    </span>
                    .
                  </span>
                </li>
              )}
              {opportunity.risk_level && (
                <li>
                  <span className="text-slate-400">Risk / difficulty:</span>{" "}
                  <span className="text-slate-200">
                    Risk flagged as{" "}
                    <span className="font-medium capitalize">
                      {opportunity.risk_level}
                    </span>{" "}
                    and operational difficulty{" "}
                    <span className="font-medium capitalize">
                      {opportunity.difficulty_level ?? "unspecified"}
                    </span>
                    .
                  </span>
                </li>
              )}
              <li>
                <span className="text-slate-400">Lifecycle:</span>{" "}
                <span className="text-slate-200">
                  Detected {formatDate(opportunity.detected_at)} and currently{" "}
                  <span className="capitalize">{opportunity.status}</span>.
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-300">
          <h3 className="text-sm font-semibold text-slate-50">
            Opportunity Snapshot
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <InfoRow label="Asset" value={opportunity.asset_symbol ?? "–"} />
            <InfoRow label="Pair" value={`${opportunity.base_symbol ?? "–"}/${opportunity.quote_symbol ?? "–"}`} />
            <InfoRow
              label="Estimated cost"
              value={formatCurrency(opportunity.estimated_cost)}
            />
            <InfoRow
              label="Estimated upside"
              value={formatPercent(opportunity.estimated_upside)}
            />
            <InfoRow
              label="Estimated ROI"
              value={formatPercent(opportunity.estimated_roi_percent)}
            />
            <InfoRow label="Source" value={opportunity.source ?? "–"} />
          </div>
        </div>
      </section>

      <div className="grid gap-4 md:grid-cols-[1.6fr,1.2fr]">
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-slate-50">
            Score Breakdown
          </h3>
          <ScoreBreakdown opportunity={opportunity} />

          <TradeFeasibility opportunity={opportunity} />

          <AiAnalysis opportunity={opportunity} />

          <ResearchReport opportunity={opportunity} />

          <TradeSimulation opportunity={opportunity} />
        </div>
        <OpportunityTimeline opportunity={opportunity} />
      </div>

      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
        <h3 className="text-sm font-semibold text-slate-50">
          Related Opportunities
        </h3>
        {related.length === 0 ? (
          <p className="mt-2 text-xs text-slate-500">
            No closely related opportunities are active right now. As the engine
            finds more trades in this lane, they&apos;ll be surfaced here.
          </p>
        ) : (
          <ul className="mt-3 space-y-2 text-xs text-slate-200">
            {related.map((op) => (
              <li key={op.id} className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-medium text-slate-100 line-clamp-1">
                    {op.title}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {op.asset_symbol ?? op.type} ·{" "}
                    {(op.total_score * 100).toFixed(0)} score
                  </p>
                </div>
                <Link
                  href={`/opportunities/${op.slug}`}
                  className="rounded-full border border-slate-700 bg-slate-950 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-200 hover:border-emerald-500 hover:text-emerald-300"
                >
                  View
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

type InfoRowProps = {
  label: string;
  value: string;
};

function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wide text-slate-500">
        {label}
      </span>
      <span className="text-xs text-slate-200">{value}</span>
    </div>
  );
}

