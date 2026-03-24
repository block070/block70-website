import { getCategoryDescription } from "@/lib/category-descriptions";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * 300–500 word expandable SEO block with internal links to representative coins.
 */
export function buildCategorySeoHtml(
  slug: string,
  title: string,
  topCoins: { slug: string; name: string }[]
): string {
  const short = getCategoryDescription(slug, title);
  const linkList = topCoins.slice(0, 8);
  const coinLinks =
    linkList.length > 0
      ? linkList
          .map(
            (c) =>
              `<a href="/coins/${encodeURIComponent(c.slug)}" class="text-crypto-blue hover:underline">${escapeHtml(c.name)}</a>`
          )
          .join(", ")
      : `<a href="/coins" class="text-crypto-blue hover:underline">Browse all coins</a>`;

  const p1 = `${escapeHtml(short)} Understanding how ${escapeHtml(title)} fits into the broader crypto market helps you compare narratives, liquidity, and risk. Block70 aggregates public market data so you can scan movers, volume, and composite scores without switching tabs.`;
  const p2 = `Sector rotation matters: when risk appetite rises, capital often flows into specific themes before it spreads to the rest of the market. ${escapeHtml(title)} is one lens for grouping tokens that share similar technology, go-to-market, or user behavior. Use category pages alongside signals, news, and on-chain context before sizing any position.`;
  const p3 = `Liquidity and volatility can differ widely even inside the same category. Smaller names may swing harder than large caps; stablecoin-heavy sectors may show muted percentage moves but enormous turnover. Always verify contract addresses, circulating supply, and project disclosures from primary sources.`;
  const p4 = `Representative projects you can explore on Block70 include: ${coinLinks}. Each coin page includes price context, Block70-style scoring, and links to related tools across the platform.`;
  const p5 = `When you research ${escapeHtml(title)}, ask which problem the protocol solves, who pays for the service, and how demand scales if adoption grows. Token incentives can bootstrap usage but may also dilute holders if emissions are high. Compare fully diluted valuation to circulating supply, and note whether revenue or fees accrue to token holders or only to the protocol treasury.`;
  const p6 = `Market structure for ${escapeHtml(title)} can include pure application tokens, infrastructure layers, and wrapped or bridged representations of the same asset on multiple chains. Cross-chain bridges, custodial wrappers, and synthetic versions can trade at different prices and carry different counterparty risk. Read the issuer’s documentation before assuming two tickers are economically identical.`;
  const p7 = `Regulatory treatment varies by jurisdiction and asset type. Some tokens are marketed as utilities or governance instruments; others may be classified as securities or e-money depending on facts and circumstances. Block70 does not provide legal or tax guidance—consult qualified professionals for your situation.`;
  const p8 = `Technical due diligence often overlaps with operational due diligence: open-source repositories, audit reports, bug bounty programs, and incident response history. For DePIN and infrastructure plays, uptime, geographic distribution, and hardware economics matter as much as tokenomics. For consumer-facing apps, retention, composability with wallets, and integration with exchanges or fiat ramps can drive adoption curves.`;
  const p9 = `Use category-level stats as a map, not a verdict. A hot sector can still contain weak individual projects; a dull sector may hide idiosyncratic winners. Combine category averages with coin-level scores, recent news, and liquidity depth before acting.`;
  const p10 = `For a wider lens, pair this category with our <a href="/trending" class="text-crypto-blue hover:underline">Trending</a> list and <a href="/signals" class="text-crypto-blue hover:underline">Signals</a> hub. Nothing here is investment advice; it is educational market intelligence.`;

  return `<div class="space-y-3 text-sm leading-relaxed text-[var(--b70-text-muted)]"><p>${p1}</p><p>${p2}</p><p>${p3}</p><p>${p4}</p><p>${p5}</p><p>${p6}</p><p>${p7}</p><p>${p8}</p><p>${p9}</p><p>${p10}</p></div>`;
}
