import type { WalletActivityItem, WalletLedgerItem } from "@/lib/api";
type Props = {
  opportunityItems: WalletActivityItem[];
  ledgerItems: WalletLedgerItem[];
  opportunityDisclaimer?: string;
};

export function RecentActionsFeed({
  opportunityItems,
  ledgerItems,
  opportunityDisclaimer,
}: Props) {
  const hasLedger = ledgerItems.length > 0;
  const hasOpp = opportunityItems.length > 0;

  return (
    <div className="space-y-6">
      <section>
        <h3 className="text-sm font-semibold text-[var(--b70-text)]">On-chain ledger</h3>
        <p className="mt-1 text-[11px] text-[var(--b70-text-muted)]">
          Buys, sells, and transfers from the indexer. Empty until `wallet_ledger_events` is populated.
        </p>
        {!hasLedger ? (
          <p className="mt-3 rounded-lg border border-dashed border-[var(--b70-border)] bg-[var(--b70-card)]/50 p-4 text-xs text-[var(--b70-text-muted)]">
            No indexed events yet. Run the ledger backfill job when the indexer pipeline is wired.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {ledgerItems.map((ev) => (
              <li
                key={ev.id}
                className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)]/60 px-3 py-2 text-xs"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium capitalize text-[var(--b70-text)]">
                    {ev.event_type.replace(/_/g, " ")}
                  </span>
                  <span className="text-[var(--b70-text-muted)]">
                    {new Date(ev.occurred_at).toLocaleString()}
                  </span>
                </div>
                <p className="mt-1 font-[family-name:var(--font-jetbrains)] text-[var(--b70-text-muted)]">
                  {ev.token_symbol ?? "—"}{" "}
                  {ev.amount_usd_est != null ? `~$${ev.amount_usd_est.toFixed(0)}` : ""}
                  {ev.counterparty ? ` · → ${ev.counterparty.slice(0, 12)}…` : ""}
                </p>
                {ev.tx_hash ? (
                  <p className="mt-1 text-[10px] text-[var(--b70-text-muted)] break-all">{ev.tx_hash}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="text-sm font-semibold text-[var(--b70-text)]">Engine signals</h3>
        {opportunityDisclaimer ? (
          <p className="mt-1 text-[11px] text-amber-200/80">{opportunityDisclaimer}</p>
        ) : null}
        {!hasOpp ? (
          <p className="mt-3 text-xs text-[var(--b70-text-muted)]">
            No wallet-type opportunities matched this address.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {opportunityItems.map((item) => (
              <li
                key={item.id}
                className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)]/60 px-3 py-2 text-xs"
              >
                <span className="font-medium text-[var(--b70-text)]">{item.title}</span>
                <p className="mt-1 line-clamp-2 text-[var(--b70-text-muted)]">{item.summary}</p>
                <p className="mt-1 text-[10px] text-[var(--b70-text-muted)]">
                  Score {(item.total_score * 100).toFixed(0)} ·{" "}
                  {item.detected_at ? new Date(item.detected_at).toLocaleString() : "—"}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
