import type { OpportunityFilter } from "@/lib/types";

export type AdvancedFiltersValue = {
  roi: string;
  score: string;
  confidence: string;
  chain: string;
  opportunityType: string;
  riskLevel: string;
  difficulty: string;
};

export type AdvancedFiltersProps = {
  value: AdvancedFiltersValue;
  onChange: (value: AdvancedFiltersValue) => void;
  disabled?: boolean;
};

const RISK_LEVEL_OPTIONS: Array<string> = ["low", "medium", "high"];
const DIFFICULTY_LEVEL_OPTIONS: Array<string> = ["easy", "medium", "hard"];

const TYPE_OPTIONS: Array<OpportunityFilter["type"]> = [
  "arbitrage",
  "mining",
  "wallet",
  "airdrop",
  "narrative",
  "project_discovery",
];

export function AdvancedFilters({
  value,
  onChange,
  disabled = false,
}: AdvancedFiltersProps) {
  const handleFieldChange = (field: keyof AdvancedFiltersValue, next: string) => {
    onChange({ ...value, [field]: next });
  };

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-950/80 p-4">
      <div className="flex flex-wrap gap-4 text-xs">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wide text-slate-400">
            Min ROI (%)
          </label>
          <input
            type="number"
            min={0}
            value={value.roi}
            onChange={(e) => handleFieldChange("roi", e.target.value)}
            placeholder="e.g. 25"
            className="h-8 w-24 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-500"
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
            value={value.score}
            onChange={(e) => handleFieldChange("score", e.target.value)}
            placeholder="e.g. 70"
            className="h-8 w-24 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-500"
            disabled={disabled}
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wide text-slate-400">
            Min Confidence (%)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={value.confidence}
            onChange={(e) => handleFieldChange("confidence", e.target.value)}
            placeholder="e.g. 60"
            className="h-8 w-28 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-500"
            disabled={disabled}
          />
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
            Opportunity Type
          </label>
          <select
            value={value.opportunityType}
            onChange={(e) =>
              handleFieldChange("opportunityType", e.target.value)
            }
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
            Risk Level
          </label>
          <select
            value={value.riskLevel}
            onChange={(e) => handleFieldChange("riskLevel", e.target.value)}
            className="h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none focus:border-emerald-500"
            disabled={disabled}
          >
            <option value="">All</option>
            {RISK_LEVEL_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wide text-slate-400">
            Difficulty
          </label>
          <select
            value={value.difficulty}
            onChange={(e) => handleFieldChange("difficulty", e.target.value)}
            className="h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none focus:border-emerald-500"
            disabled={disabled}
          >
            <option value="">All</option>
            {DIFFICULTY_LEVEL_OPTIONS.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      </div>
    </section>
  );
}

