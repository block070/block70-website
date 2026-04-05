import { readFileSync } from "node:fs";
import { query } from "../../db/pool.js";
import { completeText } from "./openai.client.js";
import { enrichArticleMarkdown } from "./internal-link-injector.js";
import { config } from "../../config.js";

const DEFAULT_CRYPTO_SYSTEM = `You are a senior crypto markets editor writing for a site like CoinDesk or The Block.
Write accurate, neutral news analysis. No financial advice. Short paragraphs. Strong H2/H3 structure.
Include a compelling meta description suggestion in the first line as: META: ...
Do not add a "Related Coins" or "Latest Signals" section — those are appended automatically for internal linking.`;

function articleSystemPrompt(): string {
  const filePath = config.articleSystemPromptFile;
  if (filePath) {
    try {
      const text = readFileSync(filePath, "utf8").trim();
      if (text) return text;
    } catch (e) {
      console.warn("[content-generator] ARTICLE_SYSTEM_PROMPT_FILE:", e);
    }
  }
  if (config.articleSystemPromptRaw) return config.articleSystemPromptRaw;
  return DEFAULT_CRYPTO_SYSTEM;
}

export async function generateSeoArticle(topic: {
  id: string;
  headline: string;
  summary: string | null;
  bullets: string[];
}): Promise<void> {
  const user = `Topic headline: ${topic.headline}
Summary: ${topic.summary ?? "N/A"}
Source headlines (for context only, synthesize do not copy):
${topic.bullets.join("\n")}

Produce:
1) One line META: description (155 chars max)
2) Full article in Markdown (title as # H1, then sections). ~900-1200 words.`;

  const raw = await completeText(articleSystemPrompt(), user);

  const assetsRow = await query<{ mentioned_assets: string[] | null }>(
    `SELECT mentioned_assets FROM topics WHERE id = $1`,
    [topic.id]
  );
  const mentionedAssets = assetsRow.rows[0]?.mentioned_assets ?? null;

  const body = enrichArticleMarkdown(raw, mentionedAssets);
  const title = topic.headline;

  await query(
    `INSERT INTO content_pieces (topic_id, kind, title, body, meta, model)
     VALUES ($1, 'seo_article', $2, $3, $4, $5)
     ON CONFLICT (topic_id, kind) DO UPDATE SET
       title = EXCLUDED.title,
       body = EXCLUDED.body,
       meta = EXCLUDED.meta,
       created_at = now()`,
    [topic.id, title, body, JSON.stringify({ generator: "openai" }), config.openaiModel]
  );
}
