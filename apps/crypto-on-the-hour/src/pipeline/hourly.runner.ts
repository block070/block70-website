/**
 * Hourly pipeline — stages:
 * 1) Fetch RSS → 2) store raw articles (dedupe via content_hash) → 3) cluster → 4) rank →
 * 5) AI generation + save → 6) website / video / social triggers.
 */
import { query } from "../db/pool.js";
import { logError, logInfo, logWarn } from "../lib/logger.js";
import { ingestAllRssFeeds } from "../modules/ingestion/rss.service.js";
import { clusterRecentArticles } from "../modules/clustering/cluster.service.js";
import { refreshMentionedAssetsForRecentTopics } from "../modules/topics/topic-assets.js";
import { rankTopics, listTopTopicsForGeneration } from "../modules/ranking/topic-ranker.js";
import { generateSeoArticle } from "../modules/ai/content-generator.js";
import { generateVideoScript } from "../modules/ai/video-script-generator.js";
import { generateLinkedInPost } from "../modules/ai/social-generator.js";
import { publishTopicBundle } from "../publishers/orchestrator.js";

export type HourlyRunStats = {
  rss: { fetched: number; inserted: number };
  cluster: { topicsCreated: number; linksAdded: number };
  rank: { updated: number };
  generated: number;
  published: number;
  topicErrors: { topicId: string; headline: string; error: string }[];
};

export async function runHourlyPipeline(): Promise<HourlyRunStats> {
  const run = await query<{ id: string }>(
    `INSERT INTO pipeline_runs (status) VALUES ('running') RETURNING id`
  );
  const runId = run.rows[0]!.id;

  const stats: HourlyRunStats = {
    rss: { fetched: 0, inserted: 0 },
    cluster: { topicsCreated: 0, linksAdded: 0 },
    rank: { updated: 0 },
    generated: 0,
    published: 0,
    topicErrors: [],
  };

  try {
    logInfo("hourly.pipeline", "step 1-2: fetch RSS + store raw (dedupe on hash)");
    stats.rss = await ingestAllRssFeeds();
    logInfo("hourly.pipeline", "RSS complete", stats.rss);

    logInfo("hourly.pipeline", "step 3-4: cluster articles into topics + dedupe near-duplicates");
    stats.cluster = await clusterRecentArticles();
    const assets = await refreshMentionedAssetsForRecentTopics(24 * 60);
    logInfo("hourly.pipeline", "cluster complete", { ...stats.cluster, assetsUpdated: assets.updated });

    logInfo("hourly.pipeline", "step 5: rank topics");
    stats.rank = await rankTopics();
    logInfo("hourly.pipeline", "rank complete", stats.rank);

    logInfo("hourly.pipeline", "step 6-8: generate content, save, publish (website / video / social)");
    const candidates = await listTopTopicsForGeneration(5);
    logInfo("hourly.pipeline", "topics selected for generation", { count: candidates.length });

    for (const topic of candidates) {
      try {
        await generateSeoArticle(topic);
        await generateVideoScript(topic);
        await generateLinkedInPost(topic);
        stats.generated += 1;
        const pub = await publishTopicBundle(topic.id);
        stats.published += pub.sent;
        if (pub.errors.length) {
          const combined = pub.errors.join("; ");
          logWarn("hourly.pipeline", "publish partial failure", { topicId: topic.id, errors: pub.errors });
          stats.topicErrors.push({ topicId: topic.id, headline: topic.headline, error: combined });
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        logError("hourly.pipeline", "topic pipeline failed", { topicId: topic.id, error: msg });
        stats.topicErrors.push({ topicId: topic.id, headline: topic.headline, error: msg });
      }
    }

    if (stats.topicErrors.length) {
      logWarn("hourly.pipeline", "run finished with topic-level errors", {
        count: stats.topicErrors.length,
      });
    }

    await query(
      `UPDATE pipeline_runs SET status = 'ok', finished_at = now(), stats = $2::jsonb WHERE id = $1`,
      [runId, JSON.stringify(stats)]
    );
    return stats;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logError("hourly.pipeline", "fatal pipeline error", { error: msg });
    await query(`UPDATE pipeline_runs SET status = 'failed', finished_at = now(), error = $2 WHERE id = $1`, [
      runId,
      msg,
    ]);
    throw e;
  }
}
