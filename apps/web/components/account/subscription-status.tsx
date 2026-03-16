type Props = {
  planType: "free" | "pro" | "elite";
  status: string;
  nextBillingDate?: string | null;
};

export function SubscriptionStatus({ planType, status, nextBillingDate }: Props) {
  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-xs">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-slate-400">Current plan</p>
          <p className="text-sm font-semibold capitalize text-slate-50">
            {planType}
          </p>
        </div>
        <span className="rounded-full border border-emerald-500/40 px-2 py-1 text-[10px] uppercase tracking-wide text-emerald-300">
          {status}
        </span>
      </div>
      {nextBillingDate && (
        <p className="mt-3 text-[11px] text-slate-400">
          Next billing date:{" "}
          <span className="font-medium">
            {new Date(nextBillingDate).toLocaleDateString()}
          </span>
        </p>
      )}
    </div>
  );
}

