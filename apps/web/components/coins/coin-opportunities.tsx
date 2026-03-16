import type { Opportunity } from "@/lib/types";

type Props = {
  symbol: string;
  opportunities: Opportunity[];
};

export function CoinOpportunities({ symbol, opportunities }: Props) {
  if (!opportunities.length) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs">
        <p className="text-[11px] uppercase tracking-wide text-slate-400">
          Opportunities
        </p>
        <p className="mt-2 text-slate-400">
          No Block70 opportunities currently mapped to {symbol}. This surface
          stays quiet until the engine has something real to say.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">
        Opportunities for {symbol}
      </p>
      <div className="space-y-2">
        {opportunities.map((opportunity) => (
          <article
            key={opportunity.id}
            className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-sm font-medium text-slate-50">
                {opportunity.title}
              </h3>
              <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-300">
                {opportunity.type}
              </span>
            </div>
            {opportunity.summary && (
              <p className="mt-1 text-[11px] text-slate-400">
                {opportunity.summary}
              </p>
            )}
            <p className="mt-2 text-[11px] text-slate-500">
              Score:{" "}
              <span className="font-medium text-slate-100">
                {Math.round(opportunity.total_score * 100)} / 100
              </span>{" "}
              · Chain:{" "}
              <span className="text-slate-200">
                {opportunity.chain ?? "N/A"}
              </span>
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}

