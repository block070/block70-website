"use client";

import { hierarchy, treemap } from "d3-hierarchy";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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

export function MarketHeatmap({ coins = [] }: MarketHeatmapProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const chartHeight = 430;

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;

    const update = () => {
      const width = Math.floor(node.getBoundingClientRect().width);
      setContainerWidth(width > 0 ? width : 0);
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const data = useMemo<TreemapNode[]>(
    () =>
      coins.slice(0, 50).map((coin) => ({
        ...coin,
        size: Math.max(coin.marketCap, 1),
      })),
    [coins],
  );
  const positioned = useMemo(() => {
    if (containerWidth <= 0 || data.length === 0) return [];
    const root = hierarchy<{ children: TreemapNode[] }>({ children: data })
      .sum((d: any) => d.size || 0)
      .sort((a, b) => (b.value || 0) - (a.value || 0));
    treemap<{ children: TreemapNode[] }>()
      .size([containerWidth, chartHeight])
      .paddingInner(2)
      .round(true)(root);
    return root.leaves();
  }, [containerWidth, data]);

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
        <div
          ref={containerRef}
          className="mt-3 h-[430px] w-full overflow-hidden rounded-lg border border-slate-800 bg-slate-900/50"
        >
          {containerWidth > 0 ? (
            <svg width={containerWidth} height={chartHeight} viewBox={`0 0 ${containerWidth} ${chartHeight}`}>
              {positioned.map((leaf) => {
                const d = leaf.data as TreemapNode;
                const x = leaf.x0;
                const y = leaf.y0;
                const w = Math.max(0, leaf.x1 - leaf.x0);
                const h = Math.max(0, leaf.y1 - leaf.y0);
                const showDetails = w > 100 && h > 58;
                const changeTxt = `${d.change24h >= 0 ? "+" : ""}${d.change24h.toFixed(2)}%`;
                return (
                  <g
                    key={d.slug}
                    onClick={() => router.push(`/coins/${d.slug}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <title>{`${d.name} (${d.symbol})\nPrice: ${formatPrice(d.price)}\n24h: ${changeTxt}\n24h Volume: ${formatMarketCap(d.volume24h)}\nMarket Cap: ${formatMarketCap(d.marketCap)}`}</title>
                    <rect
                      x={x}
                      y={y}
                      width={w}
                      height={h}
                      fill={colorForChange(d.change24h)}
                      stroke="#0f172a"
                      strokeWidth={1}
                      rx={2}
                    />
                    {showDetails ? (
                      <>
                        <text x={x + 6} y={y + 16} fill="#ffffff" fontSize={12} fontWeight={700}>
                          {d.symbol}
                        </text>
                        <text x={x + 6} y={y + 31} fill="#e2e8f0" fontSize={11}>
                          {formatPrice(d.price)}
                        </text>
                        <text x={x + 6} y={y + 46} fill="#f8fafc" fontSize={11}>
                          {changeTxt}
                        </text>
                      </>
                    ) : (
                      <text x={x + 5} y={y + 14} fill="#ffffff" fontSize={11} fontWeight={700}>
                        {d.symbol}
                      </text>
                    )}
                  </g>
                );
              })}
            </svg>
          ) : (
            <div className="flex h-full items-center justify-center text-xs text-slate-500">
              Loading heatmap…
            </div>
          )}
        </div>
      )}
    </section>
  );
}
