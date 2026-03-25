import { config } from "../config.js";

export type LinkedInPayload = { topicId: string; text: string };

/**
 * LinkedIn UGC Posts API (simplified). Requires LINKEDIN_ACCESS_TOKEN + author URN.
 * https://learn.microsoft.com/en-us/linkedin/marketing/integrations/community-management/shares/ugc-post-api
 */
export async function postToLinkedIn(payload: LinkedInPayload): Promise<void> {
  const token = config.linkedinAccessToken;
  const author = config.linkedinOrgUrn;
  if (!token || !author) {
    console.warn("[publish:linkedin] tokens not set; skipping");
    return;
  }

  const res = await fetch("https://api.linkedin.com/v2/ugcPosts", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "X-Restli-Protocol-Version": "2.0.0",
    },
    body: JSON.stringify({
      author,
      lifecycleState: "PUBLISHED",
      specificContent: {
        "com.linkedin.ugc.ShareContent": {
          shareCommentary: { text: payload.text },
          shareMediaCategory: "NONE",
        },
      },
      visibility: { "com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC" },
    }),
  });
  if (!res.ok) throw new Error(`LinkedIn ${res.status}: ${await res.text()}`);
}
