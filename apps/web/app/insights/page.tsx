import { Suspense } from "react";
import { appendFileSync } from "fs";
import { join } from "path";
import {
  getAIInsightsLatest,
  getLatestBriefing,
  getNarrativesList,
  type MarketNarrativeDto,
  type AIInsightDto,
} from "@/lib/api";
import { withTimeout } from "@/lib/with-timeout";
import { AiInsightsEngineClient } from "@/components/ai/ai-insights-engine-client";

export const revalidate = 60;

const FETCH_MS = 8_000;

function InsightsFallback() {
  return (
    <div className="space-y-4 animate-pulse">
      <div className="h-32 rounded-2xl bg-[var(--b70-border)]/50" />
      <div className="h-48 rounded-xl bg-[var(--b70-border)]/50" />
    </div>
  );
}

export default async function AIInsightsFeedPage() {
  const loadWarnings: string[] = [];
  const generatedAt = new Date().toISOString();

  const insightsP = withTimeout(
    getAIInsightsLatest(80).catch(() => {
      loadWarnings.push("AI insights feed could not be loaded.");
      return [] as AIInsightDto[];
    }),
    FETCH_MS,
    [],
  );

  const briefingP = withTimeout(
    getLatestBriefing().catch(() => {
      loadWarnings.push("Latest briefing unavailable.");
      return null;
    }),
    FETCH_MS,
    null,
  );

  const narrativesP = withTimeout(
    getNarrativesList({ limit: 24 }).catch(() => {
      loadWarnings.push("Narratives list unavailable.");
      return [] as MarketNarrativeDto[];
    }),
    FETCH_MS,
    [],
  );

  const [rawInsights, briefingRaw, narratives] = await Promise.all([
    insightsP,
    briefingP,
    narrativesP,
  ]);

  const briefing =
    briefingRaw != null
      ? {
          id: briefingRaw.id,
          summary: briefingRaw.summary,
          created_at: briefingRaw.created_at,
        }
      : null;

  if (
    loadWarnings.length === 0 &&
    rawInsights.length === 0 &&
    !briefing &&
    narratives.length === 0
  ) {
    loadWarnings.push(
      "No insight data in view—check API connectivity or seed insights.",
    );
  }

  // #region agent log
  try {
    const logPath = join(process.cwd(), "..", "..", "debug-9aa1f6.log");
    appendFileSync(
      logPath,
      `${JSON.stringify({
        sessionId: "9aa1f6",
        hypothesisId: "H2",
        location: "insights/page.tsx:AIInsightsFeedPage",
        message: "insights server render after fetch",
        data: {
          insightCount: rawInsights.length,
          warningCount: loadWarnings.length,
          warnings: loadWarnings.slice(),
        },
        timestamp: Date.now(),
      })}\n`,
    );
  } catch {
    /* ignore */
  }
  // #endregion

  return (
    <Suspense fallback={<InsightsFallback />}>
      <AiInsightsEngineClient
        initialInsights={rawInsights}
        briefing={briefing}
        narratives={narratives}
        loadWarnings={loadWarnings}
        generatedAt={generatedAt}
      />
    </Suspense>
  );
}
