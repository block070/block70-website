/**
 * Server-side RSS fetch for news fallbacks (avoids browser CORS on /api/news/* routes).
 */

export type RssFeedItem = {
  id: number;
  title: string;
  source: string;
  url: string;
  summary: string | null;
  published_at: string | null;
};

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function stripHtmlTags(input: string): string {
  return input.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function parseRssItems(
  xml: string,
  source: string,
  startId: number,
  maxItems: number,
): RssFeedItem[] {
  const items: RssFeedItem[] = [];
  const itemRegex = /<item[\s\S]*?<\/item>/gi;
  const blocks = xml.match(itemRegex) ?? [];
  for (const block of blocks) {
    const title = block.match(/<title>([\s\S]*?)<\/title>/i)?.[1]?.trim();
    const link = block.match(/<link>([\s\S]*?)<\/link>/i)?.[1]?.trim();
    const description = block.match(
      /<description>([\s\S]*?)<\/description>/i,
    )?.[1]?.trim();
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i)?.[1]?.trim();
    if (!title || !link) continue;
    items.push({
      id: startId + items.length,
      title: stripHtmlTags(decodeHtmlEntities(title)),
      source,
      url: decodeHtmlEntities(link),
      summary: description
        ? stripHtmlTags(decodeHtmlEntities(description))
        : null,
      published_at: pubDate ? new Date(pubDate).toISOString() : null,
    });
    if (items.length >= maxItems) break;
  }
  return items;
}

/** Multiple URLs per source — some CDNs return 308 unless URL matches canonical. */
const FEEDS: { source: string; urls: string[] }[] = [
  {
    source: "CoinDesk",
    urls: [
      "https://www.coindesk.com/arc/outboundfeeds/rss/",
      "https://www.coindesk.com/arc/outboundfeeds/rss/?outputType=xml",
    ],
  },
  { source: "Cointelegraph", urls: ["https://cointelegraph.com/rss"] },
  { source: "Decrypt", urls: ["https://decrypt.co/feed"] },
];

async function fetchOneFeed(
  source: string,
  urls: string[],
  startId: number,
  perFeedLimit: number,
): Promise<RssFeedItem[]> {
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        cache: "no-store",
        redirect: "follow",
        headers: { Accept: "application/rss+xml, application/xml, text/xml, */*" },
      });
      if (!res.ok) continue;
      const xml = await res.text();
      return parseRssItems(xml, source, startId, perFeedLimit);
    } catch {
      /* try next URL */
    }
  }
  return [];
}

/**
 * Pull headlines from public RSS feeds (Node / Route Handler only).
 */
export async function fetchRssDirectFallback(limit = 50): Promise<RssFeedItem[]> {
  const perFeed = Math.max(5, Math.ceil(limit / 2));
  const results = await Promise.all(
    FEEDS.map((feed, idx) =>
      fetchOneFeed(feed.source, feed.urls, (idx + 1) * 10_000, perFeed),
    ),
  );

  return results
    .flat()
    .sort((a, b) => {
      const ta = a.published_at ? new Date(a.published_at).getTime() : 0;
      const tb = b.published_at ? new Date(b.published_at).getTime() : 0;
      return tb - ta;
    })
    .slice(0, limit);
}
