"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { BotConfig } from "@/lib/bots-api";

const SIGNAL_TYPES = [
  "wallet_accumulation",
  "volume_spike",
  "whale_alert",
  "price_breakout",
  "liquidity_signal",
  "narrative_signal",
];

type BotSettingsProps = {
  config: BotConfig | null;
  onSave: (config: BotConfig) => void;
  saving?: boolean;
};

export function BotSettings({ config, onSave, saving }: BotSettingsProps) {
  const [minConfidence, setMinConfidence] = useState(
    config?.min_confidence ?? 0.5
  );
  const [signalTypes, setSignalTypes] = useState<string[]>(
    config?.signal_types ?? []
  );
  const [tokenFilter, setTokenFilter] = useState(
    (config?.token_filter ?? []).join(", ")
  );

  const handleSave = () => {
    const tokenFilterList = tokenFilter
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    onSave({
      min_confidence: minConfidence,
      signal_types: signalTypes.length > 0 ? signalTypes : undefined,
      token_filter: tokenFilterList.length > 0 ? tokenFilterList : undefined,
    });
  };

  const toggleSignalType = (type: string) => {
    setSignalTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">
          Minimum confidence (0–1)
        </label>
        <input
          type="number"
          min={0}
          max={1}
          step={0.05}
          className="w-full max-w-[120px] rounded border border-[var(--b70-border)] bg-slate-900 px-3 py-2 text-sm text-slate-100"
          value={minConfidence}
          onChange={(e) => setMinConfidence(Number(e.target.value))}
        />
      </div>
      <div>
        <label className="mb-2 block text-xs font-medium text-slate-400">
          Signal types (leave empty for all)
        </label>
        <div className="flex flex-wrap gap-2">
          {SIGNAL_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => toggleSignalType(type)}
              className={`rounded border px-2 py-1 text-xs ${
                signalTypes.includes(type)
                  ? "border-crypto-blue bg-crypto-blue/20 text-slate-200"
                  : "border-[var(--b70-border)] text-slate-500 hover:border-slate-600"
              }`}
            >
              {type.replace(/_/g, " ")}
            </button>
          ))}
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">
          Token filter (comma-separated symbols; leave empty for all)
        </label>
        <input
          type="text"
          placeholder="SOL, ETH, BTC"
          className="w-full rounded border border-[var(--b70-border)] bg-slate-900 px-3 py-2 text-sm text-slate-100"
          value={tokenFilter}
          onChange={(e) => setTokenFilter(e.target.value)}
        />
      </div>
      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save settings"}
      </Button>
    </div>
  );
}
