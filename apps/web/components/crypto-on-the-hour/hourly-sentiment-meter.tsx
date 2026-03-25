"use client";

type Props = {
  sentiment: "bullish" | "bearish" | "neutral";
  score: number;
};

/** score 0–1: higher → more bullish tilt in heuristic */
export function HourlySentimentMeter({ sentiment, score }: Props) {
  const pct = Math.round(Math.min(1, Math.max(0, score)) * 100);
  const barColor =
    sentiment === "bullish"
      ? "bg-emerald-500"
      : sentiment === "bearish"
        ? "bg-rose-500"
        : "bg-slate-500";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] uppercase tracking-wide text-slate-400">
          Hourly narrative
        </span>
        <span
          className={`text-[11px] font-semibold ${
            sentiment === "bullish"
              ? "text-emerald-400"
              : sentiment === "bearish"
                ? "text-rose-400"
                : "text-slate-300"
          }`}
        >
          {sentiment.charAt(0).toUpperCase() + sentiment.slice(1)}{" "}
          <span className="font-normal text-slate-500">({pct}%)</span>
        </span>
      </div>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full rounded-full ${barColor} transition-all duration-500 ease-out`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-[10px] text-slate-500">
        From Crypto On the Hour topic & mention text (keyword heuristic — not trading
        advice).
      </p>
    </div>
  );
}
