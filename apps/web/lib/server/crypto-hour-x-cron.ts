import type { Pool } from "pg";

import { chicagoHourRangeUtc, nowChicagoParts } from "@/lib/server/crypto-hour-buckets";
import { listPublishedArticlesInRange } from "@/lib/server/published-articles";
import {
  buildCryptoHourTweetText,
  postCryptoHourTweet,
} from "@/lib/server/post-crypto-hour-x";

export type CryptoHourXCronResult =
  | { ok: true; skipped: true; reason: string }
  | { ok: true; skipped: false; topic_id: string; slot_index: number; x_post_id: string }
  | { ok: false; error: string };

/**
 * Two posting windows per Chicago hour (for a 5-minute Vercel cron):
 * - slot 0: minutes 5–12 (first briefing of the hour, soon after :00)
 * - slot 1: minutes 35–42 (second briefing, ~:30)
 */
export function detectChicagoPostingSlot(now: Date): 0 | 1 | null {
  const { minute } = nowChicagoParts(now);
  if (minute >= 5 && minute <= 12) return 0;
  if (minute >= 35 && minute <= 42) return 1;
  return null;
}

async function slotAlreadyFilled(
  pool: Pool,
  hourBucketStart: Date,
  slotIndex: number,
): Promise<boolean> {
  const r = await pool.query<{ n: string }>(
    `SELECT count(*)::text AS n FROM crypto_hour_x_posts
     WHERE hour_bucket_start = $1 AND slot_index = $2`,
    [hourBucketStart.toISOString(), slotIndex]
  );
  return parseInt(r.rows[0]?.n ?? "0", 10) > 0;
}

export async function runCryptoHourXPostSlot(pool: Pool, now: Date): Promise<CryptoHourXCronResult> {
  const slot = detectChicagoPostingSlot(now);
  if (slot === null) {
    return { ok: true, skipped: true, reason: "outside_posting_windows" };
  }

  const { year, month, day, hour } = nowChicagoParts(now);
  const { start: hourBucketStart, end: hourBucketEnd } = chicagoHourRangeUtc(year, month, day, hour);

  if (await slotAlreadyFilled(pool, hourBucketStart, slot)) {
    return { ok: true, skipped: true, reason: "slot_already_posted" };
  }

  const articles = await listPublishedArticlesInRange(pool, hourBucketStart, hourBucketEnd, 200);
  if (!articles.length) {
    return { ok: true, skipped: true, reason: "no_articles_in_hour_bucket" };
  }

  const used = await pool.query<{ topic_id: string }>(
    `SELECT topic_id FROM crypto_hour_x_posts WHERE topic_id = ANY($1::uuid[])`,
    [articles.map((a) => a.topic_id)]
  );
  const posted = new Set(used.rows.map((r) => r.topic_id));
  const next = articles.filter((a) => posted.has(a.topic_id) === false).sort((a, b) => {
    const ta = a.updated_at.getTime();
    const tb = b.updated_at.getTime();
    if (ta !== tb) return ta - tb;
    return a.title.localeCompare(b.title);
  })[0];

  if (!next) {
    return { ok: true, skipped: true, reason: "all_hour_articles_already_posted_to_x" };
  }

  const text = buildCryptoHourTweetText(next.title, next.topic_slug);
  let xPostId: string;
  try {
    xPostId = await postCryptoHourTweet(text);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg };
  }

  await pool.query(
    `INSERT INTO crypto_hour_x_posts (topic_id, hour_bucket_start, slot_index, x_post_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (topic_id) DO NOTHING`,
    [next.topic_id, hourBucketStart.toISOString(), slot, xPostId]
  );

  return {
    ok: true,
    skipped: false,
    topic_id: next.topic_id,
    slot_index: slot,
    x_post_id: xPostId,
  };
}
