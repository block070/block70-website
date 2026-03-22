import { NextRequest, NextResponse } from "next/server";

const API_BASE =
  process.env.API_SERVER_URL || process.env.NEXT_PUBLIC_API_BASE_URL || "";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  if (API_BASE) {
    try {
      const res = await fetch(
        `${API_BASE}/api/v1/exchanges/${encodeURIComponent(id)}`,
        { cache: "no-store", headers: { Accept: "application/json" } }
      );
      if (res.ok) {
        const data = await res.json();
        return NextResponse.json(data);
      }
      if (res.status === 404) return NextResponse.json(null, { status: 404 });
    } catch {
      // fall through
    }
  }

  try {
    const exRes = await fetch("https://api.coingecko.com/api/v3/exchanges", {
      cache: "no-store",
      headers: { Accept: "application/json" },
    });
    if (!exRes.ok) throw new Error("CoinGecko failed");
    const rawList = (await exRes.json()) as Array<Record<string, unknown>>;
    const lower = id.toLowerCase();
    const r = rawList.find(
      (x) =>
        String(x.id).toLowerCase() === lower ||
        String(x.name).toLowerCase().replace(/\s+/g, "-") === lower
    );
    if (!r) return NextResponse.json(null, { status: 404 });

    const priceRes = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
      { cache: "no-store" }
    );
    const priceData = await priceRes.json().catch(() => ({}));
    const btcPrice = Number(priceData?.bitcoin?.usd) || 100_000;
    const volBtc = Number(r.trade_volume_24h_btc) || 0;
    const slug = String(r.name || "")
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/_/g, "-")
      .slice(0, 128);

    return NextResponse.json({
      id: r.id,
      name: r.name,
      slug,
      image: r.image || "",
      trust_score_rank: Number(r.trust_score_rank) || 999,
      trust_score: Number(r.trust_score) || 0,
      trade_volume_24h_usd: Math.round(volBtc * btcPrice * 100) / 100,
      url: r.url || "",
      final_url: r.url || "",
      year_established: r.year_established ?? null,
      country: r.country ?? null,
    });
  } catch {
    return NextResponse.json({ error: "Failed to load exchange" }, { status: 502 });
  }
}
