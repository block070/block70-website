/** Client-safe article row (`Date` JSON → string). */
export type PublishedArticleDTO = {
  topic_id: string;
  topic_slug: string;
  title: string;
  body_markdown: string;
  meta: Record<string, unknown>;
  updated_at: string;
};
