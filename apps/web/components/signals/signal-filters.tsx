"use client";

export type SignalFiltersValue = {
  chain: string;
  signal_type: string;
  confidence_min: string;
  token: string;
};

type SignalFiltersProps = {
  value: SignalFiltersValue;
  onChange: (value: SignalFiltersValue) => void;
  disabled?: boolean;
};

const SIGNAL_TYPE_OPTIONS = [
  "",
  "wallet_accumulation",
  "large_buy",
  "large_sell",
  "dex_volume_spike",
  "liquidity_increase",
  "liquidity_drop",
  "volume_spike",
  "social_mentions_spike",
  "dev_activity_spike",
  "aggregated",
  "radar_event",
];

const CHAIN_OPTIONS = ["", "ethereum", "solana", "base", "arbitrum", "polygon"];

export function SignalFilters({
  value,
  onChange,
  disabled = false,
}: SignalFiltersProps) {
  const handleFieldChange = (field: keyof SignalFiltersValue, next: string) => {
    onChange({ ...value, [field]: next });
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Chain
          </label>
          <select
            value={value.chain}
            onChange={(e) => handleFieldChange("chain", e.target.value)}
            className="h-9 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none focus:border-emerald-500"
            disabled={disabled}
          >
            <option value="">All</option>
            {CHAIN_OPTIONS.filter(Boolean).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Signal type
          </label>
          <select
            value={value.signal_type}
            onChange={(e) => handleFieldChange("signal_type", e.target.value)}
            className="h-9 min-w-[180px] rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none focus:border-emerald-500"
            disabled={disabled}
          >
            <option value="">All</option>
            {SIGNAL_TYPE_OPTIONS.filter(Boolean).map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Min confidence (%)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={value.confidence_min}
            onChange={(e) => handleFieldChange("confidence_min", e.target.value)}
            placeholder="e.g. 50"
            className="h-9 w-20 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-500"
            disabled={disabled}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            Token
          </label>
          <input
            type="text"
            value={value.token}
            onChange={(e) => handleFieldChange("token", e.target.value)}
            placeholder="Symbol or address"
            className="h-9 w-36 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-500"
            disabled={disabled}
          />
        </div>
      </div>
    </section>
  );
}
