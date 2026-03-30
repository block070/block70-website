"use client";

import { useEffect, useState } from "react";
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

const defaultRisk = (): Required<
  Pick<
    BotConfig,
    "stop_loss_pct" | "max_position_usd" | "max_daily_trades" | "risk_per_trade_pct" | "paper_trading"
  >
> => ({
  stop_loss_pct: 5,
  max_position_usd: 1000,
  max_daily_trades: 10,
  risk_per_trade_pct: 2,
  paper_trading: true,
});

export function BotSettings({ config, onSave, saving }: BotSettingsProps) {
  const [minConfidence, setMinConfidence] = useState(config?.min_confidence ?? 0.5);
  const [signalTypes, setSignalTypes] = useState<string[]>(config?.signal_types ?? []);
  const [tokenFilter, setTokenFilter] = useState((config?.token_filter ?? []).join(", "));
  const dr = defaultRisk();
  const [stopLossPct, setStopLossPct] = useState(config?.stop_loss_pct ?? dr.stop_loss_pct);
  const [maxPositionUsd, setMaxPositionUsd] = useState(
    config?.max_position_usd ?? dr.max_position_usd,
  );
  const [maxDailyTrades, setMaxDailyTrades] = useState(
    config?.max_daily_trades ?? dr.max_daily_trades,
  );
  const [riskPerTradePct, setRiskPerTradePct] = useState(
    config?.risk_per_trade_pct ?? dr.risk_per_trade_pct,
  );
  const [paperTrading, setPaperTrading] = useState(config?.paper_trading ?? dr.paper_trading);

  useEffect(() => {
    setMinConfidence(config?.min_confidence ?? 0.5);
    setSignalTypes(config?.signal_types ?? []);
    setTokenFilter((config?.token_filter ?? []).join(", "));
    setStopLossPct(config?.stop_loss_pct ?? dr.stop_loss_pct);
    setMaxPositionUsd(config?.max_position_usd ?? dr.max_position_usd);
    setMaxDailyTrades(config?.max_daily_trades ?? dr.max_daily_trades);
    setRiskPerTradePct(config?.risk_per_trade_pct ?? dr.risk_per_trade_pct);
    setPaperTrading(config?.paper_trading ?? dr.paper_trading);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reset when switching bot config
  }, [config]);

  const handleSave = () => {
    const tokenFilterList = tokenFilter
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    onSave({
      min_confidence: minConfidence,
      signal_types: signalTypes.length > 0 ? signalTypes : undefined,
      token_filter: tokenFilterList.length > 0 ? tokenFilterList : undefined,
      stop_loss_pct: stopLossPct,
      max_position_usd: maxPositionUsd,
      max_daily_trades: maxDailyTrades,
      risk_per_trade_pct: riskPerTradePct,
      paper_trading: paperTrading,
    });
  };

  const toggleSignalType = (type: string) => {
    setSignalTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--b70-text-muted)]">
          Signal filters
        </h4>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--b70-text-muted)]">
              Minimum confidence (0–1)
            </label>
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              className="w-full max-w-[120px] rounded border border-[var(--b70-border)] bg-[var(--b70-card)] px-3 py-2 text-sm text-[var(--b70-text)]"
              value={minConfidence}
              onChange={(e) => setMinConfidence(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-2 block text-xs font-medium text-[var(--b70-text-muted)]">
              Signal types (empty = all)
            </label>
            <div className="flex flex-wrap gap-2">
              {SIGNAL_TYPES.map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => toggleSignalType(type)}
                  className={`rounded border px-2 py-1 text-xs ${
                    signalTypes.includes(type)
                      ? "border-blue-500/50 bg-blue-500/15 text-[var(--b70-text)]"
                      : "border-[var(--b70-border)] text-[var(--b70-text-muted)] hover:border-[var(--b70-text-muted)]"
                  }`}
                >
                  {type.replace(/_/g, " ")}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-[var(--b70-text-muted)]">
              Token filter (comma-separated)
            </label>
            <input
              type="text"
              placeholder="SOL, ETH, BTC"
              className="w-full rounded border border-[var(--b70-border)] bg-[var(--b70-card)] px-3 py-2 text-sm text-[var(--b70-text)]"
              value={tokenFilter}
              onChange={(e) => setTokenFilter(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div>
        <h4 className="mb-3 text-xs font-semibold uppercase tracking-wide text-[var(--b70-text-muted)]">
          Risk &amp; safety
        </h4>
        <p className="mb-3 text-xs text-[var(--b70-text-muted)]">
          Stored with this automation. Live exchange execution is not yet wired — use these as
          guardrails for your own workflow or future auto-trading.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-[var(--b70-text-muted)]">Stop loss (%)</label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              className="w-full rounded border border-[var(--b70-border)] bg-[var(--b70-card)] px-3 py-2 text-sm text-[var(--b70-text)]"
              value={stopLossPct}
              onChange={(e) => setStopLossPct(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--b70-text-muted)]">
              Max position (USD)
            </label>
            <input
              type="number"
              min={0}
              step={100}
              className="w-full rounded border border-[var(--b70-border)] bg-[var(--b70-card)] px-3 py-2 text-sm text-[var(--b70-text)]"
              value={maxPositionUsd}
              onChange={(e) => setMaxPositionUsd(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--b70-text-muted)]">
              Max trades / day
            </label>
            <input
              type="number"
              min={0}
              step={1}
              className="w-full rounded border border-[var(--b70-border)] bg-[var(--b70-card)] px-3 py-2 text-sm text-[var(--b70-text)]"
              value={maxDailyTrades}
              onChange={(e) => setMaxDailyTrades(Number(e.target.value))}
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[var(--b70-text-muted)]">
              Risk per trade (% of equity)
            </label>
            <input
              type="number"
              min={0}
              max={100}
              step={0.25}
              className="w-full rounded border border-[var(--b70-border)] bg-[var(--b70-card)] px-3 py-2 text-sm text-[var(--b70-text)]"
              value={riskPerTradePct}
              onChange={(e) => setRiskPerTradePct(Number(e.target.value))}
            />
          </div>
        </div>
        <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm text-[var(--b70-text)]">
          <input
            type="checkbox"
            checked={paperTrading}
            onChange={(e) => setPaperTrading(e.target.checked)}
            className="rounded border-[var(--b70-border)]"
          />
          Paper / simulation mode (recommended until execution is connected)
        </label>
      </div>

      <Button onClick={handleSave} disabled={saving}>
        {saving ? "Saving…" : "Save automation settings"}
      </Button>
    </div>
  );
}

export function defaultAutomationRiskConfig(): Pick<
  BotConfig,
  "stop_loss_pct" | "max_position_usd" | "max_daily_trades" | "risk_per_trade_pct" | "paper_trading"
> {
  return defaultRisk();
}
