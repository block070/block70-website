import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";

type SearchResult = {
  id: string;
  category: string;
  title: string;
  subtitle?: string;
  href: string;
  price_change_24h?: number;
  trending_rank?: number;
  signal_count_24h?: number;
  source?: string;
  published_at?: string;
  score?: number;
};

function fallbackSearch(q: string, limit: number): SearchResult[] {
  const lower = q.toLowerCase();
  const results: SearchResult[] = [];
  const coins = ["BTC", "ETH", "SOL", "AVAX", "DOGE", "LINK", "UNI", "ATOM"];
  coins
    .filter((c) => c.toLowerCase().includes(lower))
    .slice(0, 3)
    .forEach((c) => {
      results.push({
        id: c,
        category: "coins",
        title: c,
        subtitle: "Coin",
        href: `/coins/${c.toLowerCase()}`,
      });
    });
  if (lower.includes("signal") || lower === "sig") {
    results.push({ id: "signals", category: "signals", title: "Signals feed", href: "/signals" });
  }
  if (lower.includes("airdrop")) {
    results.push({ id: "airdrops", category: "airdrops", title: "Airdrops", href: "/airdrops" });
  }
  if (lower.includes("wallet") || lower.includes("whale")) {
    results.push({ id: "wallets", category: "wallets", title: "Smart wallets", href: "/wallets" });
  }
  if (lower.includes("narrative")) {
    results.push({ id: "narratives", category: "narratives", title: "Narratives", href: "/narratives" });
  }
  if (lower.includes("opportunit")) {
    results.push({ id: "opportunities", category: "signals", title: "Opportunities", href: "/opportunities" });
  }
  return results.slice(0, limit);
}

function mapBackendResult(r: Record<string, unknown>): SearchResult {
  return {
    id: String(r.id ?? ""),
    category: String(r.category ?? ""),
    title: String(r.title ?? ""),
    subtitle: r.subtitle != null ? String(r.subtitle) : undefined,
    href: String(r.href ?? ""),
    price_change_24h: typeof r.price_change_24h === "number" ? r.price_change_24h : undefined,
    trending_rank: typeof r.trending_rank === "number" ? r.trending_rank : undefined,
    signal_count_24h: typeof r.signal_count_24h === "number" ? r.signal_count_24h : undefined,
    source: r.source != null ? String(r.source) : undefined,
    published_at: r.published_at != null ? String(r.published_at) : undefined,
    score: typeof r.score === "number" ? r.score : undefined,
  };
}

export async function GET(request: NextRequest) {
  const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(
    parseInt(request.nextUrl.searchParams.get("limit") ?? "8", 10) || 8,
    50,
  );

  if (!q) {
    return NextResponse.json({ results: [] });
  }

  if (API_BASE) {
    try {
      const url = new URL("/api/v1/search", API_BASE);
      url.searchParams.set("q", q);
      url.searchParams.set("limit", String(limit));
      const res = await fetch(url.toString(), { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as { results?: Record<string, unknown>[] };
        const raw = Array.isArray(data.results) ? data.results : [];
        const results = raw.map(mapBackendResult);
        return NextResponse.json({ results });
      }
    } catch {
      // fallthrough to fallback
    }
  }

  const results = fallbackSearch(q, limit);
  return NextResponse.json({ results });
}
