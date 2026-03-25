export type RssSource = {
  id: string;
  name: string;
  feed_url: string;
  weight: number;
  is_active: boolean;
};

export type RawArticle = {
  id: string;
  source_id: string;
  title: string;
  link: string;
  summary: string | null;
  published_at: Date | null;
  fetched_at: Date;
  content_hash: string;
};

export type Topic = {
  id: string;
  slug: string;
  headline: string;
  summary: string | null;
  rank_score: number;
  article_count: number;
  first_seen_at: Date;
  last_updated_at: Date;
  status: string;
};

export type ContentKind = "seo_article" | "video_script" | "linkedin_post";

export type ContentPiece = {
  id: string;
  topic_id: string;
  kind: ContentKind;
  title: string | null;
  body: string;
  meta: Record<string, unknown>;
  model: string | null;
  created_at: Date;
};

export type PublishChannel = "website" | "video" | "linkedin" | "twitter";
