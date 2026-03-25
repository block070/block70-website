import { query } from "../db/pool.js";
import { logInfo } from "../lib/logger.js";
import { publishToWebsite } from "./website.publisher.js";
import { triggerVideoGeneration } from "./video.trigger.js";
import { postToLinkedIn } from "./linkedin.publisher.js";

async function hasSuccessfulWebsitePublish(topicId: string): Promise<boolean> {
  const r = await query<{ n: string }>(
    `SELECT count(*)::text AS n FROM publish_events
     WHERE topic_id = $1 AND channel = 'website' AND status = 'sent'`,
    [topicId]
  );
  const n = parseInt(r.rows[0]?.n ?? "0", 10);
  return n > 0;
}

export async function publishTopicBundle(topicId: string): Promise<{ sent: number; errors: string[] }> {
  const pieces = await query<{ kind: string; title: string | null; body: string }>(
    `SELECT kind, title, body FROM content_pieces WHERE topic_id = $1`,
    [topicId]
  );
  const topicRow = await query<{ slug: string; headline: string }>(
    `SELECT slug, headline FROM topics WHERE id = $1`,
    [topicId]
  );
  const topicSlug = topicRow.rows[0]?.slug ?? topicId;
  const headline = topicRow.rows[0]?.headline ?? "News";

  const byKind = new Map(pieces.rows.map((r) => [r.kind, r]));
  const errors: string[] = [];
  let sent = 0;

  const seo = byKind.get("seo_article");
  if (seo) {
    try {
      const already = await hasSuccessfulWebsitePublish(topicId);
      if (already) {
        logInfo("publish", "skip website: already sent", { topicId });
      } else {
        await publishToWebsite({
          topicId,
          topicSlug,
          title: seo.title ?? headline,
          body: seo.body,
        });
        sent += 1;
        await logPublish(topicId, "website", "sent", { idempotent: false });
      }
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      errors.push(`website: ${m}`);
      await logPublish(topicId, "website", "failed", {}, m);
    }
  }

  const vid = byKind.get("video_script");
  if (vid) {
    try {
      await triggerVideoGeneration({ topicId, script: vid.body });
      sent += 1;
      await logPublish(topicId, "video", "sent", {});
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      errors.push(`video: ${m}`);
      await logPublish(topicId, "video", "failed", {}, m);
    }
  }

  const li = byKind.get("linkedin_post");
  if (li) {
    try {
      await postToLinkedIn({ topicId, text: li.body });
      sent += 1;
      await logPublish(topicId, "linkedin", "sent", {});
    } catch (e) {
      const m = e instanceof Error ? e.message : String(e);
      errors.push(`linkedin: ${m}`);
      await logPublish(topicId, "linkedin", "failed", {}, m);
    }
  }

  if (errors.length === 0) {
    await query(`UPDATE topics SET status = 'published' WHERE id = $1`, [topicId]);
  }

  return { sent, errors };
}

async function logPublish(
  topicId: string,
  channel: "website" | "video" | "linkedin" | "twitter",
  status: "pending" | "sent" | "failed",
  payload: Record<string, unknown>,
  error?: string
) {
  await query(
    `INSERT INTO publish_events (topic_id, channel, status, payload, error, updated_at)
     VALUES ($1, $2, $3, $4::jsonb, $5, now())`,
    [topicId, channel, status, JSON.stringify(payload), error ?? null]
  );
}
