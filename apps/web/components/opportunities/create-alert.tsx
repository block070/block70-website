"use client";

import { useState } from "react";

import { createPremiumAlert } from "@/lib/api";

type Props = {
  userIdentifier?: string;
};

export function CreateAlert({ userIdentifier = "local-user" }: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState<"arbitrage" | "mining" | "wallet" | "project_discovery">(
    "arbitrage",
  );
  const [minScore, setMinScore] = useState<string>("80");
  const [planType, setPlanType] = useState<"free" | "pro" | "elite">("free");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage(null);
    setError(null);

    const parsedScore = parseFloat(minScore);
    const threshold = Number.isNaN(parsedScore) ? 0 : parsedScore;
    const payload = {
      user_identifier: userIdentifier,
      plan_type: planType,
      alert_types: ["total_score"],
      minimum_score: threshold,
    };

    try {
      await createPremiumAlert(payload);
      setMessage(
        "Premium alert created. New high-scoring opportunities will trigger notifications.",
      );
      setName("");
    } catch (err) {
      setError("Unable to create alert. Please try again shortly.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/70 p-4"
    >
      <div>
        <h3 className="text-sm font-semibold text-slate-50">Create alert</h3>
        <p className="mt-1 text-xs text-slate-400">
          Define simple rules so Block70 can flag new opportunities that match your
          criteria.
        </p>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wide text-slate-400">
            Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="High conviction arbitrage"
            className="h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wide text-slate-400">
            Opportunity type
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
            className="h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none focus:border-emerald-500"
          >
            <option value="arbitrage">Arbitrage</option>
            <option value="mining">Miner ROI</option>
            <option value="wallet">Wallet activity</option>
            <option value="project_discovery">Project discovery</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wide text-slate-400">
            Minimum score (%)
          </label>
          <input
            type="number"
            min={0}
            max={100}
            value={minScore}
            onChange={(e) => setMinScore(e.target.value)}
            placeholder="e.g. 85"
            className="h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-500"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[11px] uppercase tracking-wide text-slate-400">
            Plan
          </label>
          <select
            value={planType}
            onChange={(e) => setPlanType(e.target.value as typeof planType)}
            className="h-8 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none focus:border-emerald-500"
          >
            <option value="free">Free</option>
            <option value="pro">Pro</option>
            <option value="elite">Elite</option>
          </select>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="inline-flex items-center rounded-full border border-emerald-500/70 bg-emerald-500/15 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-200 hover:bg-emerald-500/25 disabled:opacity-60"
        >
          {submitting ? "Creating…" : "Create alert"}
        </button>
        {message ? (
          <span className="text-[11px] text-emerald-300">{message}</span>
        ) : null}
        {error ? <span className="text-[11px] text-rose-300">{error}</span> : null}
      </div>
    </form>
  );
}

