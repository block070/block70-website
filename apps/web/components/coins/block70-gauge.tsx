import { clsx } from "clsx";

type Props = {
  score: number;
  className?: string;
};

const ARC_LEN = 163.4;

/** Large semi-circular SVG gauge (0–100). */
export function Block70Gauge({ score, className }: Props) {
  const s = Math.min(100, Math.max(0, score));
  const dash = (s / 100) * ARC_LEN;
  const arcColor = s >= 68 ? "#34d399" : s >= 38 ? "#fbbf24" : "#f87171";

  return (
    <div className={clsx("overflow-visible", className)} aria-label={`Block70 score ${s} out of 100`}>
      {/*
        viewBox adds top/side padding: arc apex is ~y=0 and strokeWidth 10 extends ~5px past it,
        so a viewBox starting at y=0 clips the top of the stroke.
      */}
      <svg
        width="128"
        height="84"
        viewBox="-6 -10 140 78"
        className="mx-auto block overflow-visible"
        preserveAspectRatio="xMidYMid meet"
      >
        <path
          d="M 8 56 A 56 56 0 0 1 120 56"
          fill="none"
          stroke="rgba(51, 65, 85, 0.95)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <path
          d="M 8 56 A 56 56 0 0 1 120 56"
          fill="none"
          stroke={arcColor}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${ARC_LEN}`}
        />
      </svg>
      <p className="-mt-1 text-center text-3xl font-bold tabular-nums text-slate-50">{s}</p>
      <p className="text-center text-[10px] uppercase tracking-wider text-slate-500">
        Block70 score
      </p>
    </div>
  );
}
