"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getStrategyTemplates,
  createTradingStrategy,
  type StrategyTemplateDto,
} from "@/lib/trading-strategies-api";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function StrategyCreatePage() {
  const router = useRouter();
  const [templates, setTemplates] = useState<StrategyTemplateDto[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [entryRules, setEntryRules] = useState("");
  const [exitRules, setExitRules] = useState("");
  const [conditions, setConditions] = useState<Record<string, unknown>>({});
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
    setName(t.name);
    setDescription(t.description);
    setConditions(t.conditions_json || {});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const strategy = await createTradingStrategy({
        strategy_name: name || "Untitled strategy",
        description: description || null,
        conditions_json: Object.keys(conditions).length ? conditions : undefined,
        entry_rules: entryRules || null,
        exit_rules: exitRules || null,
      });
      router.push(`/strategies?highlight=${strategy.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create strategy");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/strategies">
          <Button variant="outline">← Back</Button>
        </Link>
        <h1 className="text-2xl font-bold text-slate-50">Create strategy</h1>
      </div>

      {templates.length > 0 && (
        <Card>
          <CardHeader
            title="Templates"
            subtitle="Start from a predefined strategy"
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
                placeholder="e.g. Signal breakout"
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
                Exit rules / risk limits
              </label>
              <textarea
                value={exitRules}
                onChange={(e) => setExitRules(e.target.value)}
                rows={2}
                className="w-full rounded border border-[var(--b70-border)] bg-[var(--b70-input)] px-3 py-2 text-sm text-slate-200"
                placeholder="e.g. Take profit +10%, stop loss -5%"
              />
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

        {error && (
          <p className="text-sm text-rose-400">{error}</p>
        )}
        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating…" : "Create strategy"}
        </Button>
      </form>
    </div>
  );
}
