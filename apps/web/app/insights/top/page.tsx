import Link from "next/link";
import { getAIInsightsTop } from "@/lib/api";
import { InsightCard } from "@/components/ai/insight-card";

export const revalidate = 60;

export const metadata = {
  title: "Top AI Insights · Block70",
  description: "Highest-impact AI insights by confidence and recency.",
};

export default async function TopAIInsightsPage() {
  let insights: Awaited<ReturnType<typeof getAIInsightsTop>> = [];

  try {
    insights = await getAIInsightsTop({ limit: 30, min_confidence: 0 });
  } catch {
    // use empty
  }

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
            Top AI Insights
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Highest-impact insights by confidence score and recency.
          </p>
        </div>
        <Link
          href="/insights"
          className="text-sm font-medium text-blue-400 hover:text-blue-300"
        >
          All insights
        </Link>
      </section>

      <section className="space-y-4">
        {insights.length === 0 ? (
          <p className="rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-center text-sm text-slate-500">
            No top insights yet. Generate insights via the API or view the{" "}
            <Link href="/insights" className="text-blue-400 hover:underline">
              feed
            </Link>
            .
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
