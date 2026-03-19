import Link from "next/link";
import type { Opportunity } from "@/lib/types";

type AirdropHighlightsProps = {
  airdrops: Opportunity[];
  errorMessage?: string | null;
};

export function AirdropHighlights({
  airdrops,
  errorMessage = null,
}: AirdropHighlightsProps) {
  const active = airdrops.filter((o) => o.status === "active");
  const byValue = [...active].sort(
    (a, b) => (b.estimated_upside ?? 0) - (a.estimated_upside ?? 0),
  );
  const easyFarming = active.filter(
    (o) => (o.difficulty_level || "").toLowerCase() === "low",
  );

  const hasError = !!errorMessage;
  const hasData = airdrops.length > 0;

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <h3 className="text-sm font-semibold text-slate-50">
        Airdrop Highlights
      </h3>
      <p className="mt-0.5 text-[11px] text-slate-400">
        Top active, highest value & easy farming
      </p>
      {hasError ? (
        <p className="mt-3 text-xs text-slate-500">
          Live airdrop data temporarily unavailable. Showing{" "}
          {hasData ? "latest available numbers." : "placeholder values."}
        </p>
      ) : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            Active
          </p>
          <p className="mt-1 text-lg font-semibold text-slate-100">
            {hasData ? active.length : hasError ? "—" : 0}
          </p>
          <Link href="/airdrops" className="mt-1 block text-xs text-blue-400 hover:underline">
            View airdrops
          </Link>
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            Highest value
          </p>
          {hasData && byValue[0] ? (
            <>
              <p className="mt-1 truncate text-sm font-medium text-slate-100">
                {byValue[0].title}
              </p>
              <Link
                href={`/opportunities/${byValue[0].slug}`}
                className="mt-1 block text-xs text-blue-400 hover:underline"
              >
                View
              </Link>
            </>
          ) : (
            <p className="mt-1 text-xs text-slate-500">
              {hasError ? "Temporarily unavailable." : "—"}
            </p>
          )}
        </div>
        <div className="rounded-lg border border-slate-800 bg-slate-900/60 p-3">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            Easy farming
          </p>
          <p className="mt-1 text-lg font-semibold text-emerald-400">
            {hasData ? easyFarming.length : hasError ? "—" : 0}
          </p>
          <Link href="/airdrops" className="mt-1 block text-xs text-blue-400 hover:underline">
            View low difficulty
          </Link>
        </div>
      </div>
    </section>
  );
}
