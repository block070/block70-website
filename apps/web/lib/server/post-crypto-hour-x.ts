import { TwitterApi } from "twitter-api-v2";

import { cryptoHourArticlePath } from "@/lib/crypto-hour-url";

/** OAuth 1.0a user-context (required for posting; not app-only bearer). */
export function createXReadWriteClient(): TwitterApi | null {
  const appKey = process.env.X_API_KEY?.trim();
  const appSecret = process.env.X_API_SECRET?.trim();
  const accessToken = process.env.X_ACCESS_TOKEN?.trim();
  const accessSecret = process.env.X_ACCESS_SECRET?.trim();
  if (!appKey || !appSecret || !accessToken || !accessSecret) return null;
  return new TwitterApi({ appKey, appSecret, accessToken, accessSecret });
}

function publicSiteOrigin(): string {
  const raw =
    process.env.CRYPTO_HOUR_PUBLIC_SITE_URL?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
    "https://block70.com";
  return raw.replace(/\/$/, "");
}

export function cryptoHourArticleAbsoluteUrl(topicSlug: string): string {
  return `${publicSiteOrigin()}${cryptoHourArticlePath(topicSlug)}`;
}

/** Keep under legacy 280 limit unless you enable long posts on the account. */
export function buildCryptoHourTweetText(title: string, topicSlug: string): string {
  const url = cryptoHourArticleAbsoluteUrl(topicSlug);
  const suffix = `\n\n${url}`;
  const maxTitle = 280 - suffix.length - 1;
  let t = (title || "Crypto on the hour").trim().replace(/\s+/g, " ");
  if (t.length > maxTitle) t = `${t.slice(0, Math.max(0, maxTitle - 1))}…`;
  return `${t}${suffix}`;
}

export async function postCryptoHourTweet(text: string): Promise<string> {
  const client = createXReadWriteClient();
  if (!client) {
    throw new Error("X API credentials missing (X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET)");
  }
  const { data } = await client.v2.tweet(text);
  if (!data?.id) throw new Error("X API returned no tweet id");
  return data.id;
}
