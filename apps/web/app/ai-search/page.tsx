import { AIIntelligenceDashboard } from "@/components/ai/ai-intelligence-dashboard";

export const metadata = {
  title: "Crypto intelligence · Block70",
  description:
    "Alpha-ranked opportunities from market data: momentum, liquidity, and risk-adjusted signals. Not financial advice.",
};

export default function AISearchPage() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <AIIntelligenceDashboard />
    </div>
  );
}
