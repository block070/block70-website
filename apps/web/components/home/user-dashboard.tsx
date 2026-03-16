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
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <h3 className="text-sm font-semibold text-slate-50">
        Your dashboard
      </h3>
      <p className="mt-0.5 text-[11px] text-slate-400">
        Tracked coins, wallets, alerts & strategies
      </p>
      {!hasAny ? (
        <div className="mt-3 rounded-lg border border-dashed border-slate-700 bg-slate-900/40 p-4 text-center text-xs text-slate-500">
          <p>No tracked items yet.</p>
          <div className="mt-2 flex flex-wrap justify-center gap-2">
            <Link
              href="/watchlist"
              className="text-blue-400 hover:underline"
            >
              Watchlist
            </Link>
            <Link href="/alerts" className="text-blue-400 hover:underline">
              Alerts
            </Link>
            <Link href="/strategies" className="text-blue-400 hover:underline">
              Strategies
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Link
            href="/watchlist"
            className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-center"
          >
            <p className="text-lg font-semibold text-slate-100">
              {trackedCoinsCount}
            </p>
            <p className="text-[10px] text-slate-400">Coins</p>
          </Link>
          <Link
            href="/wallets"
            className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-center"
          >
            <p className="text-lg font-semibold text-slate-100">
              {trackedWalletsCount}
            </p>
            <p className="text-[10px] text-slate-400">Wallets</p>
          </Link>
          <Link
            href="/alerts"
            className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-center"
          >
            <p className="text-lg font-semibold text-slate-100">{alertsCount}</p>
            <p className="text-[10px] text-slate-400">Alerts</p>
          </Link>
          <Link
            href="/strategies"
            className="rounded-lg border border-slate-800 bg-slate-900/60 p-3 text-center"
          >
            <p className="text-lg font-semibold text-slate-100">
              {hasStrategies ? "1" : "0"}
            </p>
            <p className="text-[10px] text-slate-400">Strategies</p>
          </Link>
        </div>
      )}
    </section>
  );
}
