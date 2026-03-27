import "dotenv/config";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

function opt(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
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
  databaseUrl: req("DATABASE_URL"),
  redisUrl: req("REDIS_URL"),
  /** Set for workers / generation; API health can start without it */
  openaiApiKey: opt("OPENAI_API_KEY", ""),
  openaiModel: opt("OPENAI_MODEL", "gpt-4o-mini"),
  apiHost: opt("API_HOST", "0.0.0.0"),
  apiPort: parseInt(opt("API_PORT", "4001"), 10),
  topicLookbackHours: parseInt(opt("TOPIC_LOOKBACK_HOURS", "24"), 10),
  minTopicScoreToGenerate: parseFloat(opt("MIN_TOPIC_SCORE_TO_GENERATE", "3")),
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
