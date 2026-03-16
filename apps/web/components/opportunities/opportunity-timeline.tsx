import type { Opportunity } from "@/lib/types";

type Props = {
  opportunity: Opportunity;
};

function formatDate(iso: string | null): string {
  if (!iso) return "–";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "–";
  return d.toLocaleString(undefined, {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function OpportunityTimeline({ opportunity }: Props) {
  const items = [
    {
      label: "Detected",
      value: formatDate(opportunity.detected_at),
      subtle: false,
    },
    {
      label: "Last seen",
      value: formatDate(opportunity.last_seen_at),
      subtle: true,
    },
    {
      label: "Expires",
      value: formatDate(opportunity.expires_at),
      subtle: true,
    },
  ];

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
      <h3 className="text-sm font-semibold text-slate-50">Timeline</h3>
      <p className="mt-1 text-xs text-slate-400">
        How this opportunity has evolved over time.
      </p>
      <ol className="mt-4 space-y-3 text-xs text-slate-200">
        {items.map((item, idx) => (
          <li key={item.label} className="flex items-start gap-3">
            <div className="mt-0.5 flex flex-col items-center">
              <span
                className={`h-2 w-2 rounded-full ${
                  idx === 0
                    ? "bg-emerald-400"
                    : idx === items.length - 1
                      ? "bg-slate-500"
                      : "bg-slate-600"
                }`}
              />
              {idx < items.length - 1 && (
                <span className="mt-0.5 h-6 w-px bg-slate-700" />
              )}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-slate-400">
                {item.label}
              </p>
              <p className={`text-xs ${item.subtle ? "text-slate-300" : "text-slate-100"}`}>
                {item.value}
              </p>
            </div>
          </li>
        ))}
        <li className="flex items-start gap-3">
          <div className="mt-0.5 flex flex-col items-center">
            <span className="h-2 w-2 rounded-full bg-slate-500" />
          </div>
          <div>
            <p className="text-[11px] uppercase tracking-wide text-slate-400">
              Status
            </p>
            <p className="text-xs text-slate-100 capitalize">
              {opportunity.status}
            </p>
          </div>
        </li>
      </ol>
    </section>
  );
}

