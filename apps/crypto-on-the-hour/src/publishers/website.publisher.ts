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
  return `${config.pipelineSlug}-${topicId}-${hash}`;
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

  const bodyJson = JSON.stringify({
    topicId: payload.topicId,
    slug: payload.topicSlug,
    title: payload.title,
    format: "markdown",
    body: payload.body,
    source: config.pipelineSlug,
    idempotencyKey,
  });

  let res: Response;
  try {
    res = await fetch(url, {
      method: "POST",
      headers,
      body: bodyJson,
    });
  } catch (e) {
    const err = e instanceof Error ? e : new Error(String(e));
    const cause =
      err.cause instanceof Error
        ? err.cause.message
        : err.cause != null
          ? String(err.cause)
          : "";
    const detail = [err.message, cause].filter(Boolean).join(" — ");
    throw new Error(`website webhook fetch failed (${detail}). Check WEBSITE_PUBLISH_WEBHOOK_URL from this host (DNS, TLS, firewall, Docker: use host IP or host.docker.internal, not only public URL).`);
  }
  if (!res.ok) throw new Error(`website webhook ${res.status}: ${await res.text()}`);
}
