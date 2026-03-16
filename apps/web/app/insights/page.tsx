import { getAIInsightsLatest } from "@/lib/api";
import { InsightCard } from "@/components/ai/insight-card";

export const revalidate = 60;

export const metadata = {
  title: "AI Insights · Block70",
  description: "AI-generated insights from signals, wallet activity, radar, and capital flows.",
};

export default async function AIInsightsFeedPage() {
  let insights: Awaited<ReturnType<typeof getAIInsightsLatest>> = [];

  try {
    insights = await getAIInsightsLatest(30);
  } catch {
    // use empty
  }

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          AI Insights
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          Insights generated from platform data: signals, wallet activity, radar
          alerts, capital flows, and narrative trends.
        </p>
      </section>

      <section className="space-y-4">
        {insights.length === 0 ? (
          <p className="rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-center text-sm text-slate-500">
            No AI insights yet. Run the insight engine or seed examples via the
            API to populate the feed.
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
