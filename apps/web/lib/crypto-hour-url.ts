/** Client-safe URLs for Crypto On The Hour (no server DB imports). */

export const CRYPTO_ON_THE_HOUR_BASE = "/crypto-on-the-hour";

export function cryptoHourArticlePath(topicRel: string): string {
  return `${CRYPTO_ON_THE_HOUR_BASE}/${encodeURIComponent(topicRel)}`;
}
