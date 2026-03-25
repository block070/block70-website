import { createHash } from "node:crypto";
import { config } from "../config.js";

export type WebsitePayload = {
  topicId: string;
  topicSlug: string;
  title: string;
  body: string;
};

export function websiteIdempotencyKey(topicId: string, body: string): string {
  const hash = createHash("sha256").update(body, "utf8").digest("hex").slice(0, 32);
  return `crypto-on-the-hour-${topicId}-${hash}`;
}

/** POST markdown + metadata to your CMS or Next.js ingest webhook. */
export async function publishToWebsite(payload: WebsitePayload): Promise<void> {
  const url = config.websitePublishWebhookUrl;
  if (!url) {
    console.warn("[publish:website] WEBSITE_PUBLISH_WEBHOOK_URL not set; skipping");
    return;
  }
  const idempotencyKey = websiteIdempotencyKey(payload.topicId, payload.body);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "Idempotency-Key": idempotencyKey,
  };
  if (config.websitePublishSecret) {
    headers["X-Publish-Secret"] = config.websitePublishSecret;
    headers["Authorization"] = `Bearer ${config.websitePublishSecret}`;
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      topicId: payload.topicId,
      slug: payload.topicSlug,
      title: payload.title,
      format: "markdown",
      body: payload.body,
      source: "crypto-on-the-hour",
      idempotencyKey,
    }),
  });
  if (!res.ok) throw new Error(`website webhook ${res.status}: ${await res.text()}`);
}
