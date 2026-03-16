import type { OpportunityFilter } from "@/lib/types";

type FiltersValue = {
  type: string;
  chain: string;
  minScore: string;
};

type OpportunityFiltersProps = {
  value: FiltersValue;
  onChange: (value: FiltersValue) => void;
  disabled?: boolean;
};

const TYPE_OPTIONS: Array<OpportunityFilter["type"]> = [
  "arbitrage",
  "mining",
  "wallet",
  "airdrop",
  "node",
];

export function OpportunityFilters({
  value,
  onChange,
  disabled = false,
}: OpportunityFiltersProps) {
  const handleFieldChange = (field: keyof FiltersValue, next: string) => {
    onChange({ ...value, [field]: next });
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/70 p-4">
      <div className="flex flex-wrap gap-3 text-xs">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wide text-slate-400">
            Type
          </label>
          <select
            value={value.type}
            onChange={(e) => handleFieldChange("type", e.target.value)}
            className="h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none focus:border-emerald-500"
            disabled={disabled}
          >
            <option value="">All</option>
            {TYPE_OPTIONS.map((t) => (
              <option key={t} value={t ?? ""}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wide text-slate-400">
            Chain
          </label>
          <input
            type="text"
            value={value.chain}
            onChange={(e) => handleFieldChange("chain", e.target.value)}
            placeholder="e.g. solana"
            className="h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-500"
            disabled={disabled}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wide text-slate-400">
            Min Score (%)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={value.minScore}
            onChange={(e) => handleFieldChange("minScore", e.target.value)}
            placeholder="e.g. 60"
            className="h-8 w-24 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-500"
            disabled={disabled}
          />
        </div>
      </div>
    </section>
  );
}

export type { FiltersValue as OpportunityFiltersValue, OpportunityFiltersProps };

