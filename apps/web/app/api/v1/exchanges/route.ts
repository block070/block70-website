import { NextResponse } from "next/server";

const API_BASE =
  process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";

export async function GET() {
  if (API_BASE) {
    try {
      const res = await fetch(`${API_BASE}/api/v1/exchanges`, {
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
    } catch {
      // fall through to CoinGecko
    }
  }

  try {
    const [exRes, priceRes] = await Promise.all([
      fetch("https://api.coingecko.com/api/v3/exchanges", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      }),
      fetch("https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd", {
        cache: "no-store",
        headers: { Accept: "application/json" },
      }),
    ]);
    if (!exRes.ok || !priceRes.ok) throw new Error("CoinGecko failed");
    const [rawList, priceData] = await Promise.all([exRes.json(), priceRes.json()]);
    const btcPrice = Number(priceData?.bitcoin?.usd) || 100_000;

    const out = (rawList as Array<Record<string, unknown>>)
      .sort(
        (a, b) =>
          (Number(a.trust_score_rank) || 999) - (Number(b.trust_score_rank) || 999)
      )
      .slice(0, 100)
      .map((r) => {
        const volBtc = Number(r.trade_volume_24h_btc) || 0;
        const volUsd = volBtc * btcPrice;
        const slug = String(r.name || "")
          .toLowerCase()
          .replace(/\s+/g, "-")
          .replace(/_/g, "-")
          .slice(0, 128);
        return {
          id: r.id,
          name: r.name,
          image: r.image || "",
          trust_score_rank: Number(r.trust_score_rank) || 999,
          trust_score: Number(r.trust_score) || 0,
          trade_volume_24h_btc: volBtc,
          trade_volume_24h_usd: Math.round(volUsd * 100) / 100,
          url: r.url || "",
          final_url: r.url || "",
          year_established: r.year_established ?? null,
          country: r.country ?? null,
          slug,
          liquidity_score: 0.75,
          user_count_estimate: Math.floor(volUsd / 5000),
          supported_coins: 200,
        };
      });
    return NextResponse.json(out);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load exchanges" },
      { status: 502 }
    );
  }
}
