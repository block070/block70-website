import { CryptoHourDashboard } from "@/components/crypto-hour/crypto-hour-dashboard";
import { nowChicagoParts } from "@/lib/server/crypto-hour-buckets";
import { loadDayDashboard } from "@/lib/server/crypto-hour-dashboard-data";
import { getCryptoHourPool } from "@/lib/server/crypto-hour-pool";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Crypto On The Hour · Block70",
  description:
    "Live-style crypto intelligence by the hour—narratives, sentiment, entities, and market impact scores.",
};

export default async function CryptoHourIndexPage() {
  const pool = getCryptoHourPool();
  if (!pool) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 text-sm text-amber-200/90">
        Set <code className="text-xs">CRYPTO_HOUR_DATABASE_URL</code> to load the intelligence hub.
      </div>
    );
  }

  const { year, month, day } = nowChicagoParts();
  const bundle = await loadDayDashboard(pool, year, month, day);

  return (
    <CryptoHourDashboard
      intel={bundle.intel}
      articles={bundle.articles}
      nav={bundle.nav}
      sentimentTrend={bundle.sentimentTrend}
      viewGranularity={bundle.viewGranularity}
      autoRefreshNote="Narrative map shows the full day (CT); pick an hour below to zoom in"
    />
  );
}
