import Link from "next/link";
import { notFound } from "next/navigation";
import { getCoinBySlugOrMock } from "@/lib/coins";
import { getAIInsightsForToken } from "@/lib/api";
import { InsightCard } from "@/components/ai/insight-card";
import { withTimeout } from "@/lib/with-timeout";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: { params: Params }) {
  const { slug } = await params;
  try {
    const data = await getCoinBySlugOrMock(slug);
    return {
      title: `AI Insights · ${data.coin.symbol} · Block70`,
      description: `AI insights related to ${data.coin.name} (${data.coin.symbol}).`,
    };
  } catch {
    return {};
  }
}

const FETCH_TIMEOUT_MS = 8_000;

export default async function CoinInsightsPage({ params }: { params: Params }) {
  const { slug } = await params;
  let data;
  try {
    data = await withTimeout(getCoinBySlugOrMock(slug), FETCH_TIMEOUT_MS);
  } catch {
    notFound();
  }
  if (!data) notFound();

  const symbol = data.coin.symbol.toUpperCase();
  let insights: Awaited<ReturnType<typeof getAIInsightsForToken>> = [];

  try {
    insights = await getAIInsightsForToken(symbol, { limit: 30 });
  } catch {
    // use empty
  }

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
            AI Insights · {data.coin.name} ({symbol})
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            AI-generated insights related to {symbol}.
          </p>
        </div>
        <Link
          href={`/coins/${slug}`}
          className="text-sm font-medium text-blue-400 hover:text-blue-300"
        >
          Back to {symbol}
        </Link>
      </section>

      <section className="space-y-4">
        {insights.length === 0 ? (
          <p className="rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-center text-sm text-slate-500">
            No AI insights yet for {symbol}. View{" "}
            <Link href="/insights" className="text-blue-400 hover:underline">
              all insights
            </Link>{" "}
            or run the insight engine.
          </p>
        ) : (
          <ul className="space-y-4">
            {insights.map((insight) => (
              <li key={insight.id}>
                <InsightCard insight={insight} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
