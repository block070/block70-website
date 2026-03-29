"use client";

import { useEffect, useState } from "react";

import type { UserStrategy } from "@/lib/strategies";
import { createStrategy, deleteStrategy, getStrategies } from "@/lib/strategies";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { RiskWarningBanner } from "@/components/legal/risk-warning-banner";
import { RiskBadge } from "@/components/legal/risk-badge";

type ConditionRow = {
  field: "min_score" | "min_roi" | "type" | "wallet_signal_types" | "radar_min_score";
  operator: ">=" | "==" | "in";
  value: string;
};

const OPPORTUNITY_TYPES = [
  "arbitrage",
  "mining",
  "wallet",
  "airdrop",
  "narrative",
  "project_discovery",
];

export default function StrategiesPage() {
  const [strategies, setStrategies] = useState<UserStrategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [name, setName] = useState("");
  const [conditions, setConditions] = useState<ConditionRow[]>([
    { field: "min_score", operator: ">=", value: "80" },
  ]);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [userIdentifier] = useState<string>(
    process.env.NEXT_PUBLIC_USER_IDENTIFIER ?? "strategy-user",
  );

  const loadStrategies = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getStrategies();
      setStrategies(data);
    } catch {
      setError("Unable to load strategies from the backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStrategies();
  }, []);

  const handleAddCondition = () => {
    setConditions((prev) => [
      ...prev,
      { field: "min_score", operator: ">=", value: "" },
    ]);
  };

  const handleConditionChange = (index: number, patch: Partial<ConditionRow>) => {
    setConditions((prev) =>
      prev.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  const handleRemoveCondition = (index: number) => {
    setConditions((prev) => prev.filter((_, i) => i !== index));
  };

  const buildConditionsJson = (): Record<string, any> => {
    const result: Record<string, any> = {};

    for (const row of conditions) {
      if (!row.value.trim()) continue;

      switch (row.field) {
        case "min_score": {
          const v = parseFloat(row.value);
          if (!Number.isNaN(v)) {
            result.min_score = v;
          }
          break;
        }
        case "min_roi": {
          const v = parseFloat(row.value);
          if (!Number.isNaN(v)) {
            result.min_roi = v;
          }
          break;
        }
        case "type": {
          result.type = row.value;
          break;
        }
        case "wallet_signal_types": {
          const parts = row.value
            .split(",")
            .map((p) => p.trim())
            .filter(Boolean);
          if (parts.length > 0) {
            result.wallet_signal_types = parts;
          }
          break;
        }
        case "radar_min_score": {
          const v = parseFloat(row.value);
          if (!Number.isNaN(v)) {
            result.radar_min_score = v;
          }
          break;
        }
        default:
          break;
      }
    }

    return result;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const payload = {
        user_identifier: userIdentifier,
        strategy_name: name || "Untitled strategy",
        conditions: buildConditionsJson(),
      };
      await createStrategy(payload);
      setSuccessMessage(
        "Strategy saved. When new opportunities, wallet signals, and radar events match these conditions, you’ll receive alerts.",
      );
      setName("");
      setConditions([{ field: "min_score", operator: ">=", value: "80" }]);
      await loadStrategies();
    } catch {
      setError("Unable to save strategy. Please try again shortly.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteStrategy(id);
      setStrategies((prev) => prev.filter((s) => s.id !== id));
    } catch {
      // Best-effort; surface via a generic error banner if needed.
      setError("Unable to delete strategy. Please refresh and try again.");
    }
  };

  return (
    <div className="space-y-8">
      <RiskWarningBanner />
      <section>
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-slate-50">Strategies</h2>
          <RiskBadge />
        </div>
        <p className="mt-1 text-xs text-slate-400">
          Design reusable strategy rules that combine score, ROI, wallet, and radar
          signals. When conditions match, Block70&apos;s strategy engine will
          generate alerts for you.
        </p>
      </section>

      <section className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
        <h3 className="text-md font-semibold text-slate-100 mb-2">
          Trading strategies & backtests
        </h3>
        <p className="text-xs text-slate-400 mb-3">
          Run simulations and equity backtests on the Simulation hub (linked with your
          account). Create strategies here or from the hub, then open the backtester tab.
        </p>
        <div className="flex flex-wrap gap-2">
          <Link href="/simulation">
            <Button>Open simulation hub</Button>
          </Link>
          <Link href="/strategies/create">
            <Button variant="outline">Create trading strategy</Button>
          </Link>
        </div>
      </section>

      <section>
        <h3 className="text-md font-semibold text-slate-100 mb-3">Legacy strategy rules (alerts)</h3>
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-slate-800 bg-slate-950/70 p-4"
      >
        <div className="grid gap-3 md:grid-cols-[2fr,1fr]">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wide text-slate-400">
              Strategy name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="High-conviction DeFi radar"
              className="h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-500"
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wide text-slate-400">
              Alerts will be sent to
            </label>
            <input
              type="text"
              value={userIdentifier}
              readOnly
              className="h-8 cursor-not-allowed rounded-md border border-slate-800 bg-slate-950 px-2 text-xs text-slate-400"
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-50">
              Strategy conditions
            </h3>
            <button
              type="button"
              onClick={handleAddCondition}
              className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-200 hover:border-emerald-500 hover:text-emerald-300"
            >
              + Add condition
            </button>
          </div>

          <div className="space-y-2">
            {conditions.length === 0 ? (
              <p className="text-[11px] text-slate-500">
                No conditions yet. Add at least one rule to define your strategy.
              </p>
            ) : (
              conditions.map((row, index) => (
                <div
                  key={index}
                  className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/80 p-2 text-xs"
                >
                  <select
                    value={row.field}
                    onChange={(e) =>
                      handleConditionChange(index, {
                        field: e.target.value as ConditionRow["field"],
                      })
                    }
                    className="h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none focus:border-emerald-500"
                  >
                    <option value="min_score">Min score (%)</option>
                    <option value="min_roi">Min ROI (%)</option>
                    <option value="type">Opportunity type</option>
                    <option value="wallet_signal_types">Wallet signals</option>
                    <option value="radar_min_score">Radar score (%)</option>
                  </select>

                  <span className="text-[11px] text-slate-500">is</span>

                  {row.field === "type" ? (
                    <select
                      value={row.value}
                      onChange={(e) =>
                        handleConditionChange(index, { value: e.target.value })
                      }
                      className="h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none focus:border-emerald-500"
                    >
                      <option value="">Any type</option>
                      {OPPORTUNITY_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  ) : row.field === "wallet_signal_types" ? (
                    <input
                      type="text"
                      value={row.value}
                      onChange={(e) =>
                        handleConditionChange(index, { value: e.target.value })
                      }
                      placeholder="e.g. whale_entry, accumulation_spike"
                      className="h-8 min-w-[220px] flex-1 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-500"
                    />
                  ) : (
                    <input
                      type="number"
                      value={row.value}
                      onChange={(e) =>
                        handleConditionChange(index, { value: e.target.value })
                      }
                      placeholder={row.field === "min_score" ? "80" : "50"}
                      className="h-8 w-24 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-500"
                    />
                  )}

                  <button
                    type="button"
                    onClick={() => handleRemoveCondition(index)}
                    className="ml-auto inline-flex h-7 items-center justify-center rounded-full border border-slate-700 bg-slate-950 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-400 hover:border-rose-500 hover:text-rose-300"
                  >
                    Remove
                  </button>
                </div>
              ))
            )}
          </div>

          <p className="mt-1 text-[11px] text-slate-500">
            Strategies are evaluated against new opportunities and signals. When all
            conditions are satisfied, the strategy engine will emit alerts that can be
            delivered via your configured channels.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center rounded-full border border-emerald-500/70 bg-emerald-500/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Save strategy"}
          </button>
          {successMessage ? (
            <span className="text-[11px] text-emerald-300">{successMessage}</span>
          ) : null}
          {error ? <span className="text-[11px] text-rose-300">{error}</span> : null}
        </div>
      </form>
      </section>

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-slate-100">Saved strategies</h3>
        {loading ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
            Loading strategies…
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-4 text-sm text-rose-100">
            {error}
          </div>
        ) : strategies.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/60 p-6 text-sm text-slate-400">
            You haven&apos;t saved any strategies yet. Create one above to codify how
            you want Block70 to trade and track alpha on your behalf.
          </div>
        ) : (
          <div className="space-y-2">
            {strategies.map((strategy) => (
              <div
                key={strategy.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-200"
              >
                <div className="space-y-0.5">
                  <p className="font-medium text-[12px] text-slate-50">
                    {strategy.strategy_name}
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Conditions:{" "}
                    <span className="font-mono text-[10px] text-slate-300">
                      {JSON.stringify(strategy.conditions)}
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(strategy.id)}
                  className="ml-4 inline-flex h-7 items-center justify-center rounded-full border border-slate-700 bg-slate-900 px-2 text-[10px] font-semibold uppercase tracking-wide text-slate-300 hover:border-rose-500 hover:text-rose-300"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

