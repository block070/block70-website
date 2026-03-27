import { MacroIntelligenceDashboard } from "@/components/market/macro-intelligence-dashboard";
import { buildMacroDashboard } from "@/lib/market/build-macro-dashboard";

export const metadata = {
  title: "Macro intelligence · Block70",
  description:
    "Dominance, sector rotation, market heatmap, and sentiment—macro dashboard for crypto markets.",
};

export const revalidate = 60;

export default async function MarketMacroPage() {
  const data = await buildMacroDashboard();
  return <MacroIntelligenceDashboard data={data} />;
}
