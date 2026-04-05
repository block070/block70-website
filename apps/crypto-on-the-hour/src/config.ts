import "dotenv/config";

/** Default ranking boosts (crypto); override entirely with TOPIC_RANK_KEYWORDS_JSON. */
const DEFAULT_TOPIC_RANK_KEYWORDS: Record<string, number> = {
  etf: 2,
  sec: 2,
  regulation: 1.5,
  bitcoin: 1.2,
  ethereum: 1.2,
  hack: 2,
  exploit: 2,
  binance: 1.2,
  coinbase: 1.2,
  fed: 1.3,
  rate: 1,
  launch: 1,
  mainnet: 1.2,
};

function buildTopicRankKeywords(): Map<string, number> {
  const raw = process.env.TOPIC_RANK_KEYWORDS_JSON?.trim();
  if (raw) {
    try {
      const o = JSON.parse(raw) as unknown;
      if (o && typeof o === "object" && !Array.isArray(o)) {
        const m = new Map<string, number>();
        for (const [k, v] of Object.entries(o as Record<string, unknown>)) {
          const w = Number(v);
          if (k && Number.isFinite(w)) m.set(k.toLowerCase(), w);
        }
        if (m.size > 0) return m;
      }
    } catch {
      /* fall through */
    }
    console.warn("[config] TOPIC_RANK_KEYWORDS_JSON invalid; using defaults");
  }
  return new Map(Object.entries(DEFAULT_TOPIC_RANK_KEYWORDS).map(([k, v]) => [k.toLowerCase(), v]));
}

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

function opt(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

/**
 * Kebab-case id for JSON `source`, idempotency prefixes, anchors, observability tags.
 * Override per fork with PIPELINE_SLUG (e.g. climate-rss-pipeline).
 */
function normalizePipelineSlug(raw: string): string {
  let s = raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
  while (s.includes("--")) s = s.replace(/--+/g, "-");
  s = s.replace(/^-|-$/g, "");
  if (!s) {
    console.warn("[config] PIPELINE_SLUG empty after normalize; using crypto-on-the-hour");
    return "crypto-on-the-hour";
  }
  return s;
}

/** Trim, strip UTF-8 BOM and CR so .env / Windows line endings match webhook headers. */
function normalizeEnvSecret(raw: string | undefined): string {
  if (!raw) return "";
  let s = raw.trim();
  if (s.charCodeAt(0) === 0xfeff) s = s.slice(1);
  return s.replace(/\r/g, "");
}

export const config = {
  nodeEnv: opt("NODE_ENV", "development"),
  /** Machine id for webhooks, Redis job id, anchors (see PIPELINE_SLUG). */
  pipelineSlug: normalizePipelineSlug(opt("PIPELINE_SLUG", "crypto-on-the-hour")),
  /** Human-readable product name for logs and Slack. */
  pipelineDisplayName: opt("PIPELINE_DISPLAY_NAME", "Crypto On the Hour"),
  databaseUrl: req("DATABASE_URL"),
  redisUrl: req("REDIS_URL"),
  /** Set for workers / generation; API health can start without it */
  openaiApiKey: opt("OPENAI_API_KEY", ""),
  openaiModel: opt("OPENAI_MODEL", "gpt-4o-mini"),
  apiHost: opt("API_HOST", "0.0.0.0"),
  apiPort: parseInt(opt("API_PORT", "4001"), 10),
  /** Clustering + ranking time window (hours) for “recent news”. */
  topicLookbackHours: parseInt(opt("TOPIC_LOOKBACK_HOURS", "24"), 10),
  minTopicScoreToGenerate: parseFloat(opt("MIN_TOPIC_SCORE_TO_GENERATE", "3")),
  /** Heuristic boosts in topic-ranker.ts (keyword → weight). JSON object. */
  topicRankKeywords: buildTopicRankKeywords(),
  /** User-Agent for RSS fetch (some CDNs throttle generic clients). */
  rssUserAgent: opt("RSS_USER_AGENT", "Block70-RssPipeline/1.0"),
  /**
   * Optional feed list JSON: [{"source":"Name","url":"https://..."}, …]
   * Upserts into rss_sources on each ingest pass.
   */
  rssFeedsJson: process.env.RSS_FEEDS_JSON?.trim() ?? "",
  /** Inline system prompt for article generation (overrides default crypto editor). */
  articleSystemPromptRaw: process.env.ARTICLE_SYSTEM_PROMPT?.trim() ?? "",
  /** If set, read UTF-8 file contents as system prompt (higher precedence than ARTICLE_SYSTEM_PROMPT). */
  articleSystemPromptFile: process.env.ARTICLE_SYSTEM_PROMPT_FILE?.trim() ?? "",
  /**
   * JSON array of uppercase tokens for topic-assets / internal linking, e.g. ["BTC","ETH"].
   * Empty = use built-in crypto list.
   */
  mentionedAssetsJson: process.env.MENTIONED_ASSETS_JSON?.trim() ?? "",
  websitePublishWebhookUrl: process.env.WEBSITE_PUBLISH_WEBHOOK_URL ?? "",
  websitePublishSecret: normalizeEnvSecret(process.env.WEBSITE_PUBLISH_SECRET),
  videoGenerationWebhookUrl: process.env.VIDEO_GENERATION_WEBHOOK_URL ?? "",
  linkedinAccessToken: process.env.LINKEDIN_ACCESS_TOKEN ?? "",
  linkedinOrgUrn: process.env.LINKEDIN_ORG_URN ?? "",
  /** BullMQ job retries for the full hourly pipeline */
  workerJobAttempts: parseInt(opt("WORKER_JOB_ATTEMPTS", "5"), 10),
  /** Initial backoff delay (ms); BullMQ uses exponential backoff */
  workerJobBackoffMs: parseInt(opt("WORKER_JOB_BACKOFF_MS", "30000"), 10),
  /**
   * IANA timezone for the pipeline cron. BullMQ evaluates the pattern in this zone
   * (America/Chicago ≈ US Central, CST/CDT). Match `timedatectl` on the host or override via env.
   */
  pipelineCronTz: opt("PIPELINE_CRON_TZ", "America/Chicago"),
  /**
   * Cron expression for the full pipeline (RSS → generate → publish including LinkedIn).
   * Default hourly at :00. For every 30 minutes use PIPELINE_CRON_PATTERN with a 30-minute step on the minute field (see `.env.example`).
   */
  pipelineCronPattern: opt("PIPELINE_CRON_PATTERN", "0 * * * *"),
};
