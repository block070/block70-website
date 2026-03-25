/**
 * Legacy path; prefer POST /api/publish/crypto-on-the-hour.
 * Kept so existing WEBSITE_PUBLISH_WEBHOOK_URL values remain valid.
 */
export { POST } from "../crypto-on-the-hour/route";
export const runtime = "nodejs";
