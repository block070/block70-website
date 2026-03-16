"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { WidgetSettings as WidgetSettingsType } from "./widget-loader";

type WidgetSettingsProps = {
  widgetId: string;
  widgetType: string;
  currentSettings?: WidgetSettingsType;
  onSave: (settings: WidgetSettingsType) => void;
  onClose?: () => void;
};

const CHAINS = ["solana", "ethereum", "base", "arbitrum", "all"];
const SIGNAL_TYPES = ["wallet", "miner", "arbitrage", "narrative", "social", "all"];

export function WidgetSettings({
  widgetId,
  widgetType,
  currentSettings = {},
  onSave,
  onClose,
}: WidgetSettingsProps) {
  const [chain, setChain] = useState(currentSettings.chain ?? "");
  const [signalType, setSignalType] = useState(currentSettings.signal_type ?? "");
  const [token, setToken] = useState((currentSettings.token as string) ?? "");
  const [limit, setLimit] = useState(
    typeof currentSettings.limit === "number" ? currentSettings.limit : 10,
  );

  const handleSave = () => {
    const next: WidgetSettingsType = { limit };
    if (chain && chain !== "all") next.chain = chain;
    if (signalType && signalType !== "all") next.signal_type = signalType;
    if (token.trim()) next.token = token.trim();
    onSave(next);
    onClose?.();
  };

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="heading-md">Widget settings</h3>
        {onClose ? (
          <Button variant="ghost" className="text-sm px-2 py-1" onClick={onClose}>
            Close
          </Button>
        ) : null}
      </div>
      <p className="mb-3 text-xs text-slate-500">
        Configure filters for this widget (e.g. signal filters, token, chain).
      </p>
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            Chain
          </label>
          <select
            value={chain}
            onChange={(e) => setChain(e.target.value)}
            className="w-full rounded border border-[var(--b70-border)] bg-[var(--b70-input)] px-2 py-1.5 text-sm text-slate-200"
          >
            <option value="">All</option>
            {CHAINS.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            Signal type
          </label>
          <select
            value={signalType}
            onChange={(e) => setSignalType(e.target.value)}
            className="w-full rounded border border-[var(--b70-border)] bg-[var(--b70-input)] px-2 py-1.5 text-sm text-slate-200"
          >
            <option value="">All</option>
            {SIGNAL_TYPES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            Token filter
          </label>
          <input
            type="text"
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder="e.g. SOL"
            className="w-full rounded border border-[var(--b70-border)] bg-[var(--b70-input)] px-2 py-1.5 text-sm text-slate-200 placeholder:text-slate-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            Limit
          </label>
          <input
            type="number"
            min={1}
            max={50}
            value={limit}
            onChange={(e) => setLimit(parseInt(e.target.value, 10) || 10)}
            className="w-full rounded border border-[var(--b70-border)] bg-[var(--b70-input)] px-2 py-1.5 text-sm text-slate-200"
          />
        </div>
        <div className="flex gap-2 pt-2">
          <Button className="text-sm px-2 py-1" onClick={handleSave}>
            Save
          </Button>
          {onClose ? (
            <Button variant="ghost" className="text-sm px-2 py-1" onClick={onClose}>
              Cancel
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
