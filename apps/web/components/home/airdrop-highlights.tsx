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
    <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-[var(--b70-text)]">
        Airdrop Highlights
      </h3>
      <p className="mt-0.5 text-[11px] text-[var(--b70-text-muted)]">
        Top active, highest value & easy farming
      </p>
      {hasError ? (
        <p className="mt-3 text-xs text-[var(--b70-text-muted)]">
          Live airdrop data temporarily unavailable. Showing{" "}
          {hasData ? "latest available numbers." : "placeholder values."}
        </p>
      ) : null}
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] p-3 dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-[10px] uppercase tracking-wide text-[var(--b70-text-muted)]">
            Active
          </p>
          <p className="mt-1 text-lg font-semibold text-[var(--b70-text)]">
            {hasData ? active.length : hasError ? "—" : 0}
          </p>
          <Link href="/airdrops" className="mt-1 block text-xs text-blue-600 hover:underline dark:text-blue-400">
            View airdrops
          </Link>
        </div>
        <div className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] p-3 dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-[10px] uppercase tracking-wide text-[var(--b70-text-muted)]">
            Highest value
          </p>
          {hasData && byValue[0] ? (
            <>
              <p className="mt-1 truncate text-sm font-medium text-[var(--b70-text)]">
                {byValue[0].title}
              </p>
              <Link
                href={`/opportunities/${byValue[0].slug}`}
                className="mt-1 block text-xs text-blue-600 hover:underline dark:text-blue-400"
              >
                View
              </Link>
            </>
          ) : (
            <p className="mt-1 text-xs text-[var(--b70-text-muted)]">
              {hasError ? "Temporarily unavailable." : "—"}
            </p>
          )}
        </div>
        <div className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] p-3 dark:border-slate-800 dark:bg-slate-900/60">
          <p className="text-[10px] uppercase tracking-wide text-[var(--b70-text-muted)]">
            Easy farming
          </p>
          <p className="mt-1 text-lg font-semibold text-emerald-600 dark:text-emerald-400">
            {hasData ? easyFarming.length : hasError ? "—" : 0}
          </p>
          <Link href="/airdrops" className="mt-1 block text-xs text-blue-600 hover:underline dark:text-blue-400">
            View low difficulty
          </Link>
        </div>
      </div>
    </section>
  );
}
