import { query } from "../../db/pool.js";
import { completeText } from "./openai.client.js";
import { config } from "../../config.js";

const SYSTEM = `You write tight 60-second news voiceover scripts for crypto YouTube Shorts / vertical video.
Rules: ~140-160 words, present tense, hook in first 5 seconds, no financial advice, sign off "Crypto on the Hour."`;

export async function generateVideoScript(topic: {
  id: string;
  headline: string;
  summary: string | null;
  bullets: string[];
}): Promise<void> {
  const user = `Headline: ${topic.headline}
Context: ${topic.summary ?? ""}
Facts: ${topic.bullets.slice(0, 5).join(" | ")}

Output: script only, spoken form.`;

  const body = await completeText(SYSTEM, user);

  await query(
    `INSERT INTO content_pieces (topic_id, kind, title, body, meta, model)
     VALUES ($1, 'video_script', $2, $3, $4, $5)
     ON CONFLICT (topic_id, kind) DO UPDATE SET
       body = EXCLUDED.body,
       meta = EXCLUDED.meta,
       created_at = now()`,
    [topic.id, `${topic.headline} — 60s script`, body, JSON.stringify({ seconds: 60 }), config.openaiModel]
  );
}
