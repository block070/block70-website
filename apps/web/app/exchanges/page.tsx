import { EXCHANGES } from "@/lib/crypto-mock";

export const metadata = {
  title: "Exchanges · Block70 Crypto Data",
  description:
    "Exchange metrics wired into Block70’s execution and liquidity intelligence.",
};

export default function ExchangesPage() {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Exchanges</h1>
        <p className="text-sm text-slate-400">
          Centralized and on-chain venues where Block70 routes opportunities.
        </p>
      </header>
      <div className="overflow-hidden rounded-xl border border-slate-800 bg-slate-950/60">
        <table className="min-w-full text-left text-xs">
          <thead className="bg-slate-900/80 text-slate-400">
            <tr>
              <th className="px-3 py-2 font-medium">Name</th>
              <th className="px-3 py-2 font-medium">Region</th>
              <th className="px-3 py-2 text-right font-medium">24h volume</th>
              <th className="px-3 py-2 text-right font-medium">Markets</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {EXCHANGES.map((ex) => (
              <tr key={ex.id} className="hover:bg-slate-900/60">
                <td className="px-3 py-2 text-slate-50">{ex.name}</td>
                <td className="px-3 py-2 text-slate-400">
                  {ex.country ?? "—"}
                </td>
                <td className="px-3 py-2 text-right text-slate-200">
                  $
                  {Math.round(ex.volume24hUsd / 1_000_000_000).toLocaleString()}
                  B
                </td>
                <td className="px-3 py-2 text-right text-slate-200">
                  {ex.markets.toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

