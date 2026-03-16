import type { PricePoint } from "@/lib/crypto-mock";

type Props = {
  points: PricePoint[];
};

export function CoinChart({ points }: Props) {
  if (!points.length) {
    return null;
  }

  const prices = points.map((p) => p.priceUsd);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const normalized = prices.map((p) =>
    max === min ? 0.5 : (p - min) / (max - min),
  );

  const path = normalized
    .map((v, i) => {
      const x = (i / (normalized.length - 1 || 1)) * 100;
      const y = 100 - v * 100;
      return `${i === 0 ? "M" : "L"} ${x},${y}`;
    })
    .join(" ");

  const up = prices[prices.length - 1] >= prices[0];

  return (
    <div className="h-32 w-full rounded-xl border border-slate-800 bg-slate-950/60 p-3">
      <svg
        viewBox="0 0 100 100"
        preserveAspectRatio="none"
        className="h-full w-full"
      >
        <defs>
          <linearGradient id="priceGradient" x1="0" x2="0" y1="0" y2="1">
            <stop
              offset="0%"
              stopColor={up ? "#22c55e" : "#f97373"}
              stopOpacity="0.8"
            />
            <stop
              offset="100%"
              stopColor={up ? "#22c55e" : "#f97373"}
              stopOpacity="0"
            />
          </linearGradient>
        </defs>
        <path
          d={path}
          fill="none"
          stroke={up ? "#22c55e" : "#f97373"}
          strokeWidth={1.5}
        />
        <path
          d={`${path} L 100,100 L 0,100 Z`}
          fill="url(#priceGradient)"
          opacity={0.2}
        />
      </svg>
    </div>
  );
}

