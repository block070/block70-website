import { MacroIntelligenceDashboard } from "@/components/market/macro-intelligence-dashboard";
import { buildMacroDashboard } from "@/lib/market/build-macro-dashboard";

export const metadata = {
  title: "Macro intelligence · Block70",
  description:
    "Dominance, sector rotation, market heatmap, and sentiment—macro dashboard for crypto markets.",
};

/** Never ship a build-time static snapshot with empty upstreams; always assemble on request. */
export const dynamic = "force-dynamic";

export default async function MarketMacroPage() {
  const data = await buildMacroDashboard();
  return <MacroIntelligenceDashboard data={data} />;
}
