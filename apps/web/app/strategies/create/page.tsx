"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getStrategyTemplates,
  createTradingStrategy,
  type StrategyTemplateDto,
  type StrategyExecutionV1,
} from "@/lib/trading-strategies-api";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const DEFAULT_EXECUTION: StrategyExecutionV1 = {
  take_profit_pct: 10,
  stop_loss_pct: 5,
  max_hold_hours: 24,
  stake_usd: 1000,
  starting_capital: 100_000,
  max_entries_per_run: 50,
};

export default function StrategyCreatePage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<StrategyTemplateDto[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [entryRules, setEntryRules] = useState("");
  const [exitRules, setExitRules] = useState("");
  const [conditions, setConditions] = useState<Record<string, unknown>>({});
  const [execution, setExecution] =
    useState<StrategyExecutionV1>(DEFAULT_EXECUTION);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getStrategyTemplates()
      .then((r) => setTemplates(r.templates || []))
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, []);

  const applyTemplate = (t: StrategyTemplateDto) => {
    const cj = { ...(t.conditions_json || {}) } as Record<string, unknown>;
    const rawEx = cj.execution;
    delete cj.execution;
    setName(t.name);
    setDescription(t.description);
    setConditions(cj);
    if (rawEx && typeof rawEx === "object" && !Array.isArray(rawEx)) {
      setExecution({
        ...DEFAULT_EXECUTION,
        ...(rawEx as Partial<StrategyExecutionV1>),
      });
    } else {
      setExecution(DEFAULT_EXECUTION);
    }
  };

  const patchExecution = (patch: Partial<StrategyExecutionV1>) => {
    setExecution((prev) => ({ ...prev, ...patch }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createTradingStrategy({
        strategy_name: name || "Untitled strategy",
        description: description || null,
        conditions_json:
          Object.keys(conditions).length > 0 ? conditions : undefined,
        entry_rules: entryRules || null,
        exit_rules: exitRules || null,
        execution,
      });
      router.push("/simulation");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create strategy");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/simulation">
          <Button variant="outline">← Simulation hub</Button>
        </Link>
        <h1 className="text-2xl font-bold text-slate-50">Create strategy</h1>
      </div>

      {templates.length > 0 && (
        <Card>
          <CardHeader
            title="Templates"
            subtitle="Create from preset (Momentum, Breakout, Whale following)"
          />
          <div className="p-4 flex flex-wrap gap-2">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTemplate(t)}
                className="rounded-lg border border-[var(--b70-border)] px-3 py-2 text-sm text-left hover:border-[var(--b70-crypto-blue)]"
              >
                <span className="font-medium text-slate-200">{t.name}</span>
                <p className="text-xs text-slate-500 mt-0.5">{t.description}</p>
              </button>
            ))}
          </div>
        </Card>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <Card>
          <CardHeader
            title="Entry & exit conditions"
            subtitle="Define when to enter and exit trades"
          />
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Strategy name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded border border-[var(--b70-border)] bg-[var(--b70-input)] px-3 py-2 text-sm text-slate-200"
                placeholder="e.g. Momentum"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                className="w-full rounded border border-[var(--b70-border)] bg-[var(--b70-input)] px-3 py-2 text-sm text-slate-200"
                placeholder="Optional"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Entry rules
              </label>
              <textarea
                value={entryRules}
                onChange={(e) => setEntryRules(e.target.value)}
                rows={2}
                className="w-full rounded border border-[var(--b70-border)] bg-[var(--b70-input)] px-3 py-2 text-sm text-slate-200"
                placeholder="e.g. Enter when signal_strength >= 0.8 and confidence >= 0.7"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Exit rules / notes
              </label>
              <textarea
                value={exitRules}
                onChange={(e) => setExitRules(e.target.value)}
                rows={2}
                className="w-full rounded border border-[var(--b70-border)] bg-[var(--b70-input)] px-3 py-2 text-sm text-slate-200"
                placeholder="Narrative notes; execution below drives the simulator."
              />
            </div>
            <div className="rounded-lg border border-[var(--b70-border)] p-3 space-y-3">
              <h4 className="text-sm font-medium text-slate-300">
                Execution (backtest simulator)
              </h4>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    Take profit %
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min={0.1}
                    value={execution.take_profit_pct}
                    onChange={(e) =>
                      patchExecution({
                        take_profit_pct: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded border border-[var(--b70-border)] bg-[var(--b70-input)] px-2 py-1.5 text-sm text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    Stop loss %
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    min={0.1}
                    value={execution.stop_loss_pct}
                    onChange={(e) =>
                      patchExecution({
                        stop_loss_pct: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded border border-[var(--b70-border)] bg-[var(--b70-input)] px-2 py-1.5 text-sm text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    Max hold (hours)
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={execution.max_hold_hours}
                    onChange={(e) =>
                      patchExecution({
                        max_hold_hours: Number(e.target.value) || 1,
                      })
                    }
                    className="w-full rounded border border-[var(--b70-border)] bg-[var(--b70-input)] px-2 py-1.5 text-sm text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    Stake USD / trade
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={execution.stake_usd}
                    onChange={(e) =>
                      patchExecution({ stake_usd: Number(e.target.value) || 0 })
                    }
                    className="w-full rounded border border-[var(--b70-border)] bg-[var(--b70-input)] px-2 py-1.5 text-sm text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    Starting capital
                  </label>
                  <input
                    type="number"
                    min={100}
                    value={execution.starting_capital}
                    onChange={(e) =>
                      patchExecution({
                        starting_capital: Number(e.target.value) || 0,
                      })
                    }
                    className="w-full rounded border border-[var(--b70-border)] bg-[var(--b70-input)] px-2 py-1.5 text-sm text-slate-200"
                  />
                </div>
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    Max entries / run
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={500}
                    value={execution.max_entries_per_run}
                    onChange={(e) =>
                      patchExecution({
                        max_entries_per_run: Number(e.target.value) || 1,
                      })
                    }
                    className="w-full rounded border border-[var(--b70-border)] bg-[var(--b70-input)] px-2 py-1.5 text-sm text-slate-200"
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-400 mb-1">
                Conditions (JSON)
              </label>
              <textarea
                value={JSON.stringify(conditions, null, 2)}
                onChange={(e) => {
                  try {
                    setConditions(JSON.parse(e.target.value || "{}"));
                  } catch {
                    // ignore
                  }
                }}
                rows={4}
                className="w-full rounded border border-[var(--b70-border)] bg-[var(--b70-input)] px-3 py-2 text-sm font-mono text-slate-200"
              />
            </div>
          </div>
        </Card>

        {error && <p className="text-sm text-rose-400">{error}</p>}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create strategy"}
        </Button>
      </form>
    </div>
  );
}
