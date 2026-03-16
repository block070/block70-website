import { getAirdrops } from "@/lib/api";
import type { Opportunity } from "@/lib/types";
import { AirdropsClient } from "./client";

export default async function AirdropsPage() {
  let opportunities: Opportunity[] = [];
  let backendError: string | null = null;

  try {
    const data = await getAirdrops();
    opportunities = data.sort((a, b) => b.total_score - a.total_score);
  } catch (error) {
    backendError =
      "Unable to load airdrop opportunities from the backend right now.";
  }

  const active = opportunities.filter((o) => o.status === "active");
  const byDifficulty = (level: string) =>
    active.filter((o) => (o.difficulty_level || "").toLowerCase() === level);
  const easyFarming = byDifficulty("low").slice(0, 6);
  const topValue = [...active]
    .sort((a, b) => (b.estimated_upside ?? 0) - (a.estimated_upside ?? 0))
    .slice(0, 6);

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-50">Airdrop hub</h2>
          <p className="text-xs text-slate-400">
            Active and upcoming airdrops, easy farming, and top value opportunities.
          </p>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
          <h3 className="text-sm font-semibold text-slate-50">Active airdrops</h3>
          <p className="mt-1 text-xs text-slate-400">{active.length} live</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
          <h3 className="text-sm font-semibold text-slate-50">Upcoming</h3>
          <p className="mt-1 text-xs text-slate-400">Tracked from radar & narratives</p>
        </div>
      </section>

      {easyFarming.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-slate-50">Easy farming</h3>
          <p className="mt-0.5 text-xs text-slate-400">Low difficulty</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {easyFarming.map((opp) => (
              <AirdropCard key={opp.id} opportunity={opp} />
            ))}
          </div>
        </section>
      )}

      {topValue.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-slate-50">Top value airdrops</h3>
          <p className="mt-0.5 text-xs text-slate-400">By estimated upside</p>
          <div className="mt-2 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {topValue.map((opp) => (
              <AirdropCard key={opp.id} opportunity={opp} />
            ))}
          </div>
        </section>
      )}

      <section>
        <h3 className="text-sm font-semibold text-slate-50">All airdrops</h3>
        <AirdropsClient
          initialOpportunities={opportunities}
          backendError={backendError}
        />
      </section>
    </div>
  );
}

function AirdropCard({ opportunity }: { opportunity: { id: number; title: string; slug: string; estimated_upside: number | null; difficulty_level: string | null } }) {
  return (
    <a
      href={`/opportunities/${opportunity.slug}`}
      className="block rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-sm hover:border-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
    >
      <p className="font-medium text-slate-100">{opportunity.title}</p>
      <p className="mt-1 text-xs text-slate-400">
        Upside {opportunity.estimated_upside != null ? `${opportunity.estimated_upside.toFixed(0)}%` : "—"} · {opportunity.difficulty_level ?? "—"}
      </p>
    </a>
  );
}

