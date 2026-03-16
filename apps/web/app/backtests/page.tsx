import Link from "next/link";

export const metadata = {
  title: "Backtests · Block70",
  description:
    "Historical strategy performance. This is a placeholder until full backtesting is wired to the API.",
};

export default function BacktestsPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Backtests
        </h1>
        <p className="text-sm text-slate-400">
          Historical performance of strategies will appear here once the
          backtesting engine is enabled in this environment.
        </p>
      </header>

      <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-300">
        <p>
          The API already exposes strategy and backtest endpoints, but this UI
          is not yet connected to them in this build.
        </p>
        <p className="mt-2">
          In the meantime, you can explore{" "}
          <Link
            href="/strategies"
            className="text-crypto-blue hover:underline"
          >
            strategies
          </Link>{" "}
          and{" "}
          <Link
            href="/opportunities"
            className="text-crypto-blue hover:underline"
          >
            opportunities
          </Link>{" "}
          for live ideas.
        </p>
      </div>
    </div>
  );
}

