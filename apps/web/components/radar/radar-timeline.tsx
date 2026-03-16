"use client";

type RadarTimelineSignal = {
  timestamp: string;
  signal_type: string;
  description?: string;
  source?: string;
  strength?: number;
};

type Props = {
  signals: RadarTimelineSignal[];
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

function labelForType(signalType: string): string {
  switch (signalType) {
    case "wallet_accumulation":
      return "Wallet accumulation";
    case "dex_volume_spike":
      return "DEX volume spike";
    case "liquidity_increase":
      return "Liquidity increase";
    case "dev_activity_spike":
      return "Developer activity spike";
    case "social_mentions_spike":
      return "Social mentions spike";
    default:
      return signalType.replace(/_/g, " ");
  }
}

export function RadarTimeline({ signals }: Props) {
  const sorted = [...signals].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  if (!sorted.length) {
    return (
      <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4 text-xs text-slate-400">
        No radar signals have been recorded for this token yet.
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/80 p-4 text-xs text-slate-200">
      <h3 className="text-sm font-semibold text-slate-50">
        Radar Signal Timeline
      </h3>
      <p className="mt-1 text-[11px] text-slate-400">
        Chronological view of wallet accumulation, volume spikes, developer
        activity, and other radar signals contributing to this event.
      </p>

      <ol className="mt-3 space-y-2 border-l border-slate-700 pl-4">
        {sorted.map((sig, idx) => {
          const label = labelForType(sig.signal_type);
          const strength =
            typeof sig.strength === "number" && !Number.isNaN(sig.strength)
              ? `${(sig.strength * 100).toFixed(0)}%`
              : null;

          return (
            <li key={`${sig.timestamp}-${sig.signal_type}-${idx}`} className="relative">
              <span className="absolute -left-[9px] top-1 h-2 w-2 rounded-full bg-emerald-400" />
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-0.5">
                  <p className="text-[11px] font-medium text-slate-100">
                    {label}
                  </p>
                  {sig.description ? (
                    <p className="text-[11px] text-slate-400 line-clamp-2">
                      {sig.description}
                    </p>
                  ) : null}
                  <div className="flex flex-wrap gap-2 text-[10px] text-slate-500">
                    {sig.source && (
                      <span>
                        Source:{" "}
                        <span className="font-medium text-slate-300">
                          {sig.source}
                        </span>
                      </span>
                    )}
                    {strength && (
                      <span>
                        Strength:{" "}
                        <span className="font-semibold text-emerald-300">
                          {strength}
                        </span>
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-[10px] text-slate-500">
                  {formatTime(sig.timestamp)}
                </p>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

