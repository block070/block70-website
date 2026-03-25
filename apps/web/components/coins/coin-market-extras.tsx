import type { CoinMarketExtrasDto } from "@/lib/coins";

function fmtUsd(n: number | null | undefined, compact = false): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: n >= 1 ? 2 : 6,
    notation: compact && n >= 1_000_000 ? "compact" : "standard",
  }).format(n);
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  const sign = n > 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function fmtSupply(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return new Intl.NumberFormat(undefined, { maximumFractionDigits: 0 }).format(n);
}

function shortAddr(a: string): string {
  const s = a.trim();
  if (s.length <= 14) return s;
  return `${s.slice(0, 6)}…${s.slice(-4)}`;
}

type Props = {
  extras: CoinMarketExtrasDto | null | undefined;
};

export function CoinMarketExtrasPanel({ extras }: Props) {
  if (!extras) return null;
  const hasRow =
    extras.ath_usd != null ||
    extras.atl_usd != null ||
    extras.max_supply != null ||
    extras.fully_diluted_valuation_usd != null;
  const platforms = extras.platforms ?? [];
  const hasContracts = platforms.length > 0;
  if (!hasRow && !hasContracts) return null;

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs">
      <p className="text-[11px] uppercase tracking-wide text-slate-400">
        Market stats
      </p>
      <p className="mt-1 text-[10px] text-slate-500">
        ATH, ATL, supply, and contracts (CoinGecko-sourced). Not investment advice.
      </p>

      {hasRow ? (
        <dl className="mt-3 grid gap-2 sm:grid-cols-2">
          {extras.ath_usd != null ? (
            <>
              <dt className="text-slate-500">All-time high</dt>
              <dd className="text-right font-medium tabular-nums text-slate-100">
                {fmtUsd(extras.ath_usd)}{" "}
                <span className="text-[10px] font-normal text-slate-500">
                  ({fmtPct(extras.ath_change_pct_vs_current)} vs now)
                </span>
                <span className="mt-0.5 block text-[10px] font-normal text-slate-500">
                  {fmtDate(extras.ath_date)}
                </span>
              </dd>
            </>
          ) : null}
          {extras.atl_usd != null ? (
            <>
              <dt className="text-slate-500">All-time low</dt>
              <dd className="text-right font-medium tabular-nums text-slate-100">
                {fmtUsd(extras.atl_usd)}{" "}
                <span className="text-[10px] font-normal text-slate-500">
                  ({fmtPct(extras.atl_change_pct_vs_current)} vs now)
                </span>
                <span className="mt-0.5 block text-[10px] font-normal text-slate-500">
                  {fmtDate(extras.atl_date)}
                </span>
              </dd>
            </>
          ) : null}
          {extras.max_supply != null ? (
            <>
              <dt className="text-slate-500">Max supply</dt>
              <dd className="text-right tabular-nums text-slate-100">
                {fmtSupply(extras.max_supply)}
              </dd>
            </>
          ) : null}
          {extras.fully_diluted_valuation_usd != null ? (
            <>
              <dt className="text-slate-500">Fully diluted valuation</dt>
              <dd className="text-right tabular-nums text-slate-100">
                {fmtUsd(extras.fully_diluted_valuation_usd, true)}
              </dd>
            </>
          ) : null}
        </dl>
      ) : null}

      {hasContracts ? (
        <div className="mt-4 space-y-1.5">
          <p className="text-[10px] uppercase tracking-wide text-slate-500">
            Contracts
          </p>
          <ul className="space-y-1.5">
            {platforms.map((p) => (
              <li
                key={`${p.platform_id}:${p.contract_address}`}
                className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5 text-[11px]"
              >
                <span className="text-slate-400">{p.platform_id}</span>
                <code className="max-w-[min(100%,18rem)] truncate text-right text-slate-200">
                  {shortAddr(p.contract_address)}
                </code>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
