import Link from "next/link";

type UserDashboardProps = {
  trackedCoinsCount?: number;
  trackedWalletsCount?: number;
  alertsCount?: number;
  hasStrategies?: boolean;
};

export function UserDashboard({
  trackedCoinsCount = 0,
  trackedWalletsCount = 0,
  alertsCount = 0,
  hasStrategies = false,
}: UserDashboardProps) {
  const hasAny = trackedCoinsCount > 0 || trackedWalletsCount > 0 || alertsCount > 0 || hasStrategies;

  return (
    <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm">
      <h3 className="text-sm font-semibold text-[var(--b70-text)]">
        Your dashboard
      </h3>
      <p className="mt-0.5 text-[11px] text-[var(--b70-text-muted)]">
        Tracked coins, wallets, alerts & strategies
      </p>
      {!hasAny ? (
        <div className="mt-3 rounded-lg border border-dashed border-[var(--b70-border)] bg-[var(--b70-bg)] p-4 text-center text-xs text-[var(--b70-text-muted)] dark:border-slate-700 dark:bg-slate-900/40">
          <p>No tracked items yet.</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Link
              href="/watchlist"
              className="text-blue-600 hover:underline dark:text-blue-400"
            >
              Watchlist
            </Link>
            <Link href="/alerts" className="text-blue-600 hover:underline dark:text-blue-400">
              Alerts
            </Link>
            <Link href="/strategies" className="text-blue-600 hover:underline dark:text-blue-400">
              Strategies
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Link
            href="/watchlist"
            className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] p-3 text-center dark:border-slate-800 dark:bg-slate-900/60"
          >
            <p className="text-lg font-semibold text-[var(--b70-text)]">
              {trackedCoinsCount}
            </p>
            <p className="text-[10px] text-[var(--b70-text-muted)]">Coins</p>
          </Link>
          <Link
            href="/wallets"
            className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] p-3 text-center dark:border-slate-800 dark:bg-slate-900/60"
          >
            <p className="text-lg font-semibold text-[var(--b70-text)]">
              {trackedWalletsCount}
            </p>
            <p className="text-[10px] text-[var(--b70-text-muted)]">Wallets</p>
          </Link>
          <Link
            href="/alerts"
            className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] p-3 text-center dark:border-slate-800 dark:bg-slate-900/60"
          >
            <p className="text-lg font-semibold text-[var(--b70-text)]">{alertsCount}</p>
            <p className="text-[10px] text-[var(--b70-text-muted)]">Alerts</p>
          </Link>
          <Link
            href="/strategies"
            className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] p-3 text-center dark:border-slate-800 dark:bg-slate-900/60"
          >
            <p className="text-lg font-semibold text-[var(--b70-text)]">
              {hasStrategies ? "1" : "0"}
            </p>
            <p className="text-[10px] text-[var(--b70-text-muted)]">Strategies</p>
          </Link>
        </div>
      )}
    </section>
  );
}
