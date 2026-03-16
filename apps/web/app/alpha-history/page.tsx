import type { AlphaRankedOpportunity } from "@/lib/types";
import { getAlphaDaily, getAlphaHourly } from "@/lib/api";

function formatScore(score: number | null | undefined, digits = 0): string {
  if (score == null || Number.isNaN(score)) return "–";
  return `${(score * 100).toFixed(digits)}%`;
}

function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "–";
  return `${value.toFixed(digits)}%`;
}

function formatTime(iso: string | null | undefined): string {
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

export default async function AlphaHistoryPage() {
  let hourly: AlphaRankedOpportunity[] = [];
  let daily: AlphaRankedOpportunity[] = [];
  let error: string | null = null;

  try {
    const [hourlyResp, dailyResp] = await Promise.all([
      getAlphaHourly(),
      getAlphaDaily(),
    ]);
    hourly = hourlyResp ?? [];
    daily = dailyResp ?? [];
  } catch {
    error =
      "Unable to load historical alpha snapshots from the backend right now.";
  }

  const hourlyBest = hourly[0] ?? null;
  const dailyBest = daily[0] ?? null;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold text-slate-50">Alpha History</h2>
        <p className="mt-1 text-xs text-slate-400">
          Historical views of Block70&apos;s highest conviction opportunities
          over time.
        </p>
      </section>

      {error ? (
        <section className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-4 text-xs text-rose-100">
          {error}
        </section>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-200">
          <h3 className="text-sm font-semibold text-slate-50">
            Alpha of the Day
          </h3>
          {dailyBest ? (
            <AlphaSnapshotCard
              label="Daily"
              entry={dailyBest}
              highlight
            />
          ) : (
            <p className="text-[11px] text-slate-400">
              No daily alpha snapshot is available yet.
            </p>
          )}

          {daily.length > 1 ? (
            <div className="mt-3 space-y-1.5">
              {daily.slice(1, 5).map((entry) => (
                <AlphaSnapshotRow key={entry.opportunity.id} entry={entry} />
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-200">
          <h3 className="text-sm font-semibold text-slate-50">
            Alpha of the Hour
          </h3>
          {hourlyBest ? (
            <AlphaSnapshotCard
              label="Hourly"
              entry={hourlyBest}
              highlight
            />
          ) : (
            <p className="text-[11px] text-slate-400">
              No hourly alpha snapshot is available yet.
            </p>
          )}

          {hourly.length > 1 ? (
            <div className="mt-3 space-y-1.5">
              {hourly.slice(1, 5).map((entry) => (
                <AlphaSnapshotRow key={entry.opportunity.id} entry={entry} />
              ))}
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

type SnapshotProps = {
  label?: string;
  entry: AlphaRankedOpportunity;
  highlight?: boolean;
};

function AlphaSnapshotCard({ label, entry, highlight }: SnapshotProps) {
  const opp = entry.opportunity;
  const token = opp.asset_symbol ?? opp.base_symbol ?? opp.type;

  return (
    <article
      className={`relative overflow-hidden rounded-xl border p-4 ${
        highlight
          ? "border-emerald-500/70 bg-gradient-to-r from-slate-950 via-slate-950 to-emerald-950/30 shadow-lg shadow-emerald-500/25"
          : "border-slate-800 bg-slate-950/80"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1">
          {label ? (
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-300">
              {label} Alpha
            </p>
          ) : null}
          <h4 className="text-sm font-semibold text-slate-50 line-clamp-2">
            {opp.title}
          </h4>
          <p className="text-[11px] text-slate-400">
            {opp.type} · {token} ·{" "}
            <span className="capitalize">{opp.status}</span>
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wide text-slate-400">
            Alpha Score
          </p>
          <p className="text-xl font-semibold text-emerald-300">
            {formatScore(entry.alpha_score, 0)}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">
            ROI {formatPercent(opp.estimated_roi_percent ?? null, 1)}
          </p>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-slate-300 line-clamp-3">
        {opp.summary ??
          "Composite opportunity identified by the Block70 Alpha Ranking Engine."}
      </p>
      <p className="mt-2 text-[10px] text-slate-500">
        Snapshot taken at{" "}
        <span className="font-medium text-slate-300">
          {formatTime(entry.snapshot_created_at ?? opp.detected_at)}
        </span>
        .
      </p>
    </article>
  );
}

type RowProps = {
  entry: AlphaRankedOpportunity;
};

function AlphaSnapshotRow({ entry }: RowProps) {
  const opp = entry.opportunity;
  const token = opp.asset_symbol ?? opp.base_symbol ?? opp.type;

  return (
    <div className="flex items-start justify-between gap-2 rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2">
      <div className="space-y-0.5">
        <p className="text-[11px] font-medium text-slate-100 line-clamp-2">
          {opp.title}
        </p>
        <p className="text-[10px] text-slate-500">
          {token} · {opp.type} ·{" "}
          {formatScore(entry.alpha_score, 0)} alpha
        </p>
      </div>
      <p className="text-[10px] text-slate-500">
        {formatTime(entry.snapshot_created_at ?? opp.detected_at)}
      </p>
    </div>
  );
}

