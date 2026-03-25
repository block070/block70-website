import { query } from "../../db/pool.js";
import { completeText } from "./openai.client.js";
import { config } from "../../config.js";

const SYSTEM = `You write professional LinkedIn posts for a crypto media brand.
Tone: sharp, credible, no hype, no financial advice. Max ~2200 chars. 3-5 short paragraphs. 3-5 relevant hashtags at end.`;

export async function generateLinkedInPost(topic: {
  id: string;
  headline: string;
  summary: string | null;
  bullets: string[];
}): Promise<void> {
  const user = `Story: ${topic.headline}
Summary: ${topic.summary ?? ""}
Angles: ${topic.bullets.slice(0, 4).join(" | ")}

Write the LinkedIn post.`;

  const body = await completeText(SYSTEM, user);

  await query(
    `INSERT INTO content_pieces (topic_id, kind, title, body, meta, model)
     VALUES ($1, 'linkedin_post', $2, $3, $4, $5)
     ON CONFLICT (topic_id, kind) DO UPDATE SET
       body = EXCLUDED.body,
       meta = EXCLUDED.meta,
       created_at = now()`,
    [topic.id, topic.headline, body, JSON.stringify({ platform: "linkedin" }), config.openaiModel]
  );
}
