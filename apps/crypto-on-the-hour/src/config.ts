import "dotenv/config";

function req(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env: ${name}`);
  return v;
}

function opt(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
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
  websitePublishSecret: process.env.WEBSITE_PUBLISH_SECRET ?? "",
  videoGenerationWebhookUrl: process.env.VIDEO_GENERATION_WEBHOOK_URL ?? "",
  linkedinAccessToken: process.env.LINKEDIN_ACCESS_TOKEN ?? "",
  linkedinOrgUrn: process.env.LINKEDIN_ORG_URN ?? "",
  /** BullMQ job retries for the full hourly pipeline */
  workerJobAttempts: parseInt(opt("WORKER_JOB_ATTEMPTS", "5"), 10),
  /** Initial backoff delay (ms); BullMQ uses exponential backoff */
  workerJobBackoffMs: parseInt(opt("WORKER_JOB_BACKOFF_MS", "30000"), 10),
};
