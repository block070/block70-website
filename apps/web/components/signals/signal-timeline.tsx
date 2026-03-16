"use client";

import type { SignalDto } from "@/lib/types";

type SignalTimelineProps = {
  signals: SignalDto[];
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function intensityColor(strength: number): string {
  if (strength >= 0.7) return "bg-emerald-400";
  if (strength >= 0.4) return "bg-amber-400";
  return "bg-slate-500";
}

function labelForType(signalType: string): string {
  return signalType.replace(/_/g, " ");
}

export function SignalTimeline({ signals }: SignalTimelineProps) {
  const sorted = [...signals].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  );

  if (!sorted.length) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-400">
        No signals in this timeline.
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-200">
      <h3 className="text-sm font-semibold text-slate-50">Signal timeline</h3>
      <p className="mt-1 text-[11px] text-slate-400">
        Chronological view with color indicating signal intensity.
      </p>
      <ol className="mt-3 space-y-2 border-l border-slate-700 pl-4">
        {sorted.map((sig, idx) => {
          const strength = sig.signal_strength ?? 0;
          const label = labelForType(sig.signal_type);
          const token = sig.token_symbol || sig.token_address || "—";
          return (
            <li key={`${sig.id}-${idx}`} className="relative">
              <span
                className={`absolute -left-[9px] top-1.5 h-2 w-2 rounded-full ${intensityColor(strength)}`}
              />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1 space-y-0.5">
                  <p className="text-[11px] font-medium text-slate-100">
                    {label} · {token}
                  </p>
                  {sig.description ? (
                    <p className="text-[11px] text-slate-400 line-clamp-2">
                      {sig.description}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2 text-[10px] text-slate-500">
                    <span>
                      Confidence:{" "}
                      <span className="font-medium text-slate-300">
                        {(sig.confidence_score * 100).toFixed(0)}%
                      </span>
                    </span>
                    <span>
                      Strength:{" "}
                      <span className="font-medium text-emerald-300">
                        {(strength * 100).toFixed(0)}%
                      </span>
                    </span>
                  </div>
                </div>
                <p className="shrink-0 text-[10px] text-slate-500">
                  {formatTime(sig.created_at)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
