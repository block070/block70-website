import { config } from "../config.js";

export type VideoPayload = { topicId: string; script: string };

/** Trigger external video render pipeline (e.g. Remotion cloud, Lambda, third-party). */
export async function triggerVideoGeneration(payload: VideoPayload): Promise<void> {
  const url = config.videoGenerationWebhookUrl;
  if (!url) {
    console.warn("[publish:video] VIDEO_GENERATION_WEBHOOK_URL not set; skipping");
    return;
  }
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      topicId: payload.topicId,
      script: payload.script,
      durationSeconds: 60,
    }),
  });
  if (!res.ok) throw new Error(`video webhook ${res.status}: ${await res.text()}`);
}
