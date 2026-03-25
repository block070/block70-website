import { logWarn } from "./logger.js";

/** Optional Slack incoming webhook on worker failures. */
export async function alertSlack(message: string, fields?: Record<string, string>): Promise<void> {
  const url = process.env.SLACK_WEBHOOK_URL?.trim();
  if (!url) return;

  const text =
    fields && Object.keys(fields).length
      ? `${ message }\n${Object.entries(fields).map(([k, v]) => `• *${k}:* ${v}`).join("\n")}`
      : message;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) logWarn("alerting", "Slack webhook non-OK", { status: res.status });
  } catch (e) {
    logWarn("alerting", "Slack webhook failed", {
      error: e instanceof Error ? e.message : String(e),
    });
  }
}
