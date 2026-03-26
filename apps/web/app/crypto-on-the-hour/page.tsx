import { CryptoHourDashboard } from "@/components/crypto-hour/crypto-hour-dashboard";
import { nowChicagoParts } from "@/lib/server/crypto-hour-buckets";
import { loadHourDashboard } from "@/lib/server/crypto-hour-dashboard-data";
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

  const { year, month, day, hour } = nowChicagoParts();
  const bundle = await loadHourDashboard(pool, year, month, day, hour);

  return (
    <CryptoHourDashboard
      intel={bundle.intel}
      articles={bundle.articles}
      nav={bundle.nav}
      autoRefreshNote="Open this page after the top of the hour for the newest batch"
    />
  );
}
