"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { ResponsiveContainer, Tooltip, Treemap } from "recharts";

export type HeatmapCoin = {
  symbol: string;
  name: string;
  slug: string;
  price: number;
  change24h: number;
  marketCap: number;
  volume24h: number;
};

type MarketHeatmapProps = {
  coins?: HeatmapCoin[];
};

type TreemapNode = HeatmapCoin & {
  size: number;
};

function formatPrice(value: number): string {
  if (value >= 1000) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  if (value >= 1) return `$${value.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
  return `$${value.toLocaleString(undefined, { maximumFractionDigits: 6 })}`;
}

function formatMarketCap(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
  return `$${value.toFixed(0)}`;
}

function colorForChange(change: number): string {
  if (change >= 8) return "#16a34a"; // strong green
  if (change >= 2) return "#22c55e"; // light green
  if (change > -2) return "#64748b"; // neutral gray
  if (change > -8) return "#f87171"; // light red
  return "#dc2626"; // strong red
}

function TileContent(props: any) {
  const { x, y, width, height, payload } = props;
  if (!payload) return null;

  const coin = payload as TreemapNode;
  const showDetails = width > 90 && height > 56;

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{ fill: colorForChange(coin.change24h), stroke: "#0f172a", strokeWidth: 1 }}
      />
      {showDetails ? (
        <>
          <text x={x + 6} y={y + 16} fill="#ffffff" fontSize={12} fontWeight={700}>
            {coin.symbol}
          </text>
          <text x={x + 6} y={y + 30} fill="#e2e8f0" fontSize={11}>
            {formatPrice(coin.price)}
          </text>
          <text x={x + 6} y={y + 44} fill="#f8fafc" fontSize={11}>
            {coin.change24h >= 0 ? "+" : ""}
            {coin.change24h.toFixed(2)}%
          </text>
        </>
      ) : (
        <text x={x + 5} y={y + 14} fill="#ffffff" fontSize={11} fontWeight={700}>
          {coin.symbol}
        </text>
      )}
    </g>
  );
}

export function MarketHeatmap({ coins = [] }: MarketHeatmapProps) {
  const router = useRouter();
  const data = useMemo<TreemapNode[]>(
    () =>
      coins.slice(0, 50).map((coin) => ({
        ...coin,
        size: Math.max(coin.marketCap, 1),
      })),
    [coins],
  );

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <h3 className="text-sm font-semibold text-slate-50">Crypto market heatmap</h3>
      <p className="mt-0.5 text-[11px] text-slate-400">
        Treemap sized by market cap, colored by 24h price change
      </p>
      {data.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">
          Live heatmap data temporarily unavailable.
        </p>
      ) : (
        <div className="mt-3 h-[430px] w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-900/50">
          <ResponsiveContainer width="100%" height="100%">
            <Treemap
              data={data}
              dataKey="size"
              stroke="#0f172a"
              content={<TileContent />}
              onClick={(node: any) => {
                const slug = node?.payload?.slug as string | undefined;
                if (slug) router.push(`/coins/${slug}`);
              }}
            >
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;
                  const coin = payload[0].payload as TreemapNode;
                  return (
                    <div className="rounded-md border border-slate-700 bg-slate-900/95 px-3 py-2 text-xs text-slate-100 shadow-lg">
                      <p className="font-semibold">{coin.name} ({coin.symbol})</p>
                      <p>Price: {formatPrice(coin.price)}</p>
                      <p>
                        24h: {coin.change24h >= 0 ? "+" : ""}
                        {coin.change24h.toFixed(2)}%
                      </p>
                      <p>24h Volume: {formatMarketCap(coin.volume24h)}</p>
                      <p>Market Cap: {formatMarketCap(coin.marketCap)}</p>
                    </div>
                  );
                }}
              />
            </Treemap>
          </ResponsiveContainer>
        </div>
      )}
    </section>
  );
}
