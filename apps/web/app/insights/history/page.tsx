import Link from "next/link";
import { getAIInsights } from "@/lib/api";
import { InsightCard } from "@/components/ai/insight-card";

export const revalidate = 60;

export const metadata = {
  title: "AI Insight History · Block70",
  description: "Historical AI-generated insights.",
};

export default async function AIInsightsHistoryPage() {
  let insights: Awaited<ReturnType<typeof getAIInsights>> = [];

  try {
    insights = await getAIInsights({ limit: 100, offset: 0 });
  } catch {
    // use empty
  }

  return (
    <div className="space-y-6">
      <section className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
            AI Insight History
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Past AI insights ordered by creation time.
          </p>
        </div>
        <Link
          href="/insights"
          className="text-sm font-medium text-blue-400 hover:text-blue-300"
        >
          Latest feed
        </Link>
      </section>

      <section className="space-y-4">
        {insights.length === 0 ? (
          <p className="rounded-xl border border-slate-800 bg-slate-950/60 p-6 text-center text-sm text-slate-500">
            No historical insights. View the{" "}
            <Link href="/insights" className="text-blue-400 hover:underline">
              latest feed
            </Link>{" "}
            or seed examples via the API.
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
