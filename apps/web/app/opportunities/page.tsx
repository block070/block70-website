import { getOpportunities, getOpportunitiesTop } from "@/lib/api";
import type { Opportunity } from "@/lib/types";
import { OpportunitiesListClient } from "./client";
import { Card, CardHeader } from "@/components/ui/card";
import { RiskWarningBanner } from "@/components/legal/risk-warning-banner";
import { RiskBadge } from "@/components/legal/risk-badge";

export default async function OpportunitiesPage() {
  let opportunities: Opportunity[] = [];
  let topScanner: Awaited<ReturnType<typeof getOpportunitiesTop>> = [];
  let backendError: string | null = null;

  try {
    const [data, top] = await Promise.all([
      getOpportunities(),
      getOpportunitiesTop({ limit: 10 }).catch(() => []),
    ]);
    opportunities = data.sort(
      (a, b) => (b.total_score ?? 0) - (a.total_score ?? 0),
    );
    topScanner = top;
  } catch (error) {
    backendError =
      "Unable to load opportunities from the backend. Filters are disabled until the API is back.";
  }

  return (
    <div className="space-y-4">
      <RiskWarningBanner />
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-50">Opportunities</h2>
          <RiskBadge />
        </div>
      </header>
      <p className="text-xs text-slate-400">
        Highest-scoring opportunities from signals, wallet activity, capital
        flows, and radar.
      </p>

      {topScanner.length > 0 && (
        <Card>
          <CardHeader
            title="Top scanner opportunities"
            subtitle="By alpha & confidence score"
          />
          <div className="p-4">
            <ul className="space-y-2">
              {topScanner.slice(0, 5).map((o) => (
                <li
                  key={o.id}
                  className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-900/50 px-3 py-2 text-xs"
                >
                  <span className="font-medium text-slate-200">
                    {o.token_symbol}
                  </span>
                  <span className="text-slate-400">{o.opportunity_type}</span>
                  <span className="text-emerald-400">
                    α {(o.alpha_score * 100).toFixed(0)}% · conf{" "}
                    {(o.confidence_score * 100).toFixed(0)}%
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      )}

      <OpportunitiesListClient
        initialOpportunities={opportunities}
        backendError={backendError}
      />
    </div>
  );
}


