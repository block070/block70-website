"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Bot,
  ChevronRight,
  Landmark,
  Radio,
  Shield,
  TrendingUp,
} from "lucide-react";

import { BotSettings, defaultAutomationRiskConfig } from "@/components/bots/bot-settings";
import { Button } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import {
  createBot,
  deleteBot,
  listBots,
  updateBot,
  type BotConfig,
  type BotInfo,
} from "@/lib/bots-api";
import { getTradingStrategies, type TradingStrategyDto } from "@/lib/trading-strategies-api";

const EXCHANGE_PRESETS = [
  { id: "binance", label: "Binance", note: "Spot & futures (coming soon)" },
  { id: "bybit", label: "Bybit", note: "Derivatives (coming soon)" },
  { id: "okx", label: "OKX", note: "Unified account (coming soon)" },
];

export default function BotsPage() {
  const [bots, setBots] = useState<BotInfo[]>([]);
  const [strategies, setStrategies] = useState<TradingStrategyDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);

  const [newPlatform, setNewPlatform] = useState<"telegram" | "discord">("telegram");
  const [newToken, setNewToken] = useState("");
  const [newChannelId, setNewChannelId] = useState("");
  const [newStrategyId, setNewStrategyId] = useState<number | "">("");
  const [editStrategyId, setEditStrategyId] = useState<Record<number, number | "">>({});

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([
      listBots().catch(() => [] as BotInfo[]),
      getTradingStrategies().catch(() => [] as TradingStrategyDto[]),
    ])
      .then(([b, s]) => {
        setBots(Array.isArray(b) ? b : []);
        setStrategies(Array.isArray(s) ? s : []);
        setError(null);
      })
      .catch(() => setError("Failed to load automations"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const strategyLabel = useMemo(() => {
    const m = new Map<number, string>();
    for (const s of strategies) m.set(s.id, s.strategy_name);
    return m;
  }, [strategies]);

  const totals = useMemo(() => {
    const signals24h = bots.reduce((a, b) => a + (b.signals_sent_24h ?? 0), 0);
    const active = bots.filter((b) => b.is_active).length;
    return { signals24h, active, count: bots.length };
  }, [bots]);

  const handleSaveConfig = async (botId: number, config: BotConfig) => {
    setSaving(true);
    setError(null);
    try {
      await updateBot(botId, { config_json: config });
      setEditingId(null);
      load();
    } catch {
      setError("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleCreate = async () => {
    if (!newToken.trim() || !newChannelId.trim()) {
      setError("Token and channel / webhook fields are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const risk = defaultAutomationRiskConfig();
      await createBot({
        platform: newPlatform,
        bot_token: newToken.trim(),
        channel_id: newChannelId.trim(),
        config_json: risk,
        strategy_id: newStrategyId === "" ? undefined : Number(newStrategyId),
      });
      setShowAdd(false);
      setNewToken("");
      setNewChannelId("");
      setNewStrategyId("");
      load();
    } catch {
      setError("Failed to create automation");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Remove this automation? Delivery to Telegram/Discord stops immediately.")) return;
    try {
      await deleteBot(id);
      load();
    } catch {
      setError("Failed to delete");
    }
  };

  const toggleActive = async (bot: BotInfo) => {
    try {
      await updateBot(bot.id, { is_active: !bot.is_active });
      load();
    } catch {
      setError("Failed to update status");
    }
  };

  if (loading && bots.length === 0) {
    return (
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-8">
        <div className="h-10 w-64 animate-pulse rounded bg-[var(--b70-border)]" />
        <div className="h-48 animate-pulse rounded-lg bg-[var(--b70-border)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--b70-text-muted)]">
          Automation
        </p>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-[var(--b70-text)]">
              Signal trading desk
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-[var(--b70-text-muted)]">
              Route Block70 signals to Telegram or Discord, attach a strategy, and define risk
              guardrails. Exchange keys and live fills are on the roadmap—use paper mode and caps
              until execution is connected.
            </p>
          </div>
          <Button onClick={() => setShowAdd(!showAdd)}>{showAdd ? "Cancel" : "New automation"}</Button>
        </div>
      </header>

      <div
        className="rounded-xl border border-amber-500/25 bg-amber-500/5 px-4 py-3 text-sm text-amber-800 dark:text-amber-200/90"
        role="note"
      >
        <strong className="font-medium">Safety:</strong> Block70 does not execute trades on your
        behalf yet. This page configures <em>signal delivery</em> and saved risk parameters—not a
        broker link. Always verify orders on your exchange. Not financial advice.
      </div>

      {error && (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </p>
      )}

      <section className="grid gap-4 sm:grid-cols-3">
        <Card className="hover:!translate-y-0 hover:!shadow-none">
          <div className="flex items-start gap-3 p-4">
            <div className="rounded-lg bg-blue-500/15 p-2 text-blue-600 dark:text-blue-400">
              <Bot className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--b70-text-muted)]">Automations</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--b70-text)]">
                {totals.count}
              </p>
              <p className="text-xs text-[var(--b70-text-muted)]">{totals.active} active</p>
            </div>
          </div>
        </Card>
        <Card className="hover:!translate-y-0 hover:!shadow-none">
          <div className="flex items-start gap-3 p-4">
            <div className="rounded-lg bg-emerald-500/15 p-2 text-emerald-600 dark:text-emerald-400">
              <Activity className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--b70-text-muted)]">Signals delivered</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--b70-text)]">
                {totals.signals24h}
              </p>
              <p className="text-xs text-[var(--b70-text-muted)]">Since midnight UTC (all bots)</p>
            </div>
          </div>
        </Card>
        <Card className="hover:!translate-y-0 hover:!shadow-none">
          <div className="flex items-start gap-3 p-4">
            <div className="rounded-lg bg-violet-500/15 p-2 text-violet-600 dark:text-violet-400">
              <TrendingUp className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-xs font-medium text-[var(--b70-text-muted)]">Live ROI &amp; fills</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums text-[var(--b70-text)]">—</p>
              <p className="text-xs text-[var(--b70-text-muted)]">Execution engine coming soon</p>
            </div>
          </div>
        </Card>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Landmark className="h-4 w-4 text-[var(--b70-text-muted)]" aria-hidden />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--b70-text-muted)]">
            Connect exchanges
          </h2>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {EXCHANGE_PRESETS.map((ex) => (
            <Card key={ex.id} className="hover:!translate-y-0 hover:!shadow-none">
              <div className="p-4">
                <p className="font-medium text-[var(--b70-text)]">{ex.label}</p>
                <p className="mt-1 text-xs text-[var(--b70-text-muted)]">{ex.note}</p>
                <Button variant="outline" className="mt-3 w-full opacity-60" disabled>
                  Connect API
                </Button>
              </div>
            </Card>
          ))}
        </div>
        <p className="mt-2 text-xs text-[var(--b70-text-muted)]">
          API keys will use encrypted storage and read-only defaults where possible. You’ll confirm
          scopes before any live order placement.
        </p>
      </section>

      {showAdd && (
        <Card>
          <CardHeader
            title="New automation"
            subtitle="Choose strategy, risk limits, then where to deliver alerts."
          />
          <div className="grid gap-6 p-4 md:grid-cols-2">
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--b70-text-muted)]">
                  Strategy (optional)
                </label>
                <select
                  className="w-full rounded border border-[var(--b70-border)] bg-[var(--b70-card)] px-3 py-2 text-sm text-[var(--b70-text)]"
                  value={newStrategyId}
                  onChange={(e) =>
                    setNewStrategyId(e.target.value === "" ? "" : Number(e.target.value))
                  }
                >
                  <option value="">None — all filtered signals</option>
                  {strategies.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.strategy_name}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-[var(--b70-text-muted)]">
                  <Link href="/strategies" className="text-blue-600 hover:underline dark:text-blue-400">
                    Manage strategies
                  </Link>
                </p>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-[var(--b70-text-muted)]">
                  Delivery
                </label>
                <select
                  className="mb-3 w-full rounded border border-[var(--b70-border)] bg-[var(--b70-card)] px-3 py-2 text-sm text-[var(--b70-text)]"
                  value={newPlatform}
                  onChange={(e) => setNewPlatform(e.target.value as "telegram" | "discord")}
                >
                  <option value="telegram">Telegram</option>
                  <option value="discord">Discord (webhook)</option>
                </select>
                <label className="mb-1 block text-xs text-[var(--b70-text-muted)]">
                  {newPlatform === "discord" ? "Webhook URL" : "Bot token"}
                </label>
                <input
                  type="password"
                  autoComplete="off"
                  placeholder={
                    newPlatform === "discord"
                      ? "https://discord.com/api/webhooks/..."
                      : "From @BotFather"
                  }
                  className="mb-3 w-full rounded border border-[var(--b70-border)] bg-[var(--b70-card)] px-3 py-2 text-sm text-[var(--b70-text)]"
                  value={newToken}
                  onChange={(e) => setNewToken(e.target.value)}
                />
                <label className="mb-1 block text-xs text-[var(--b70-text-muted)]">
                  {newPlatform === "discord" ? "Label (optional)" : "Channel ID or @username"}
                </label>
                <input
                  type="text"
                  placeholder={
                    newPlatform === "telegram" ? "-100… or @channel" : "Channel label (optional)"
                  }
                  className="w-full rounded border border-[var(--b70-border)] bg-[var(--b70-card)] px-3 py-2 text-sm text-[var(--b70-text)]"
                  value={newChannelId}
                  onChange={(e) => setNewChannelId(e.target.value)}
                />
              </div>
            </div>
            <div className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)]/50 p-4">
              <div className="mb-2 flex items-center gap-2 text-[var(--b70-text)]">
                <Shield className="h-4 w-4 text-emerald-500" aria-hidden />
                <span className="text-sm font-medium">Initial risk profile</span>
              </div>
              <p className="mb-3 text-xs text-[var(--b70-text-muted)]">
                Defaults: {defaultAutomationRiskConfig().stop_loss_pct}% stop,{" "}
                ${defaultAutomationRiskConfig().max_position_usd} max position, paper mode on. Edit
                after create under automation settings.
              </p>
              <Button onClick={handleCreate} disabled={saving} className="w-full sm:w-auto">
                {saving ? "Creating…" : "Create automation"}
              </Button>
            </div>
          </div>
        </Card>
      )}

      <section>
        <div className="mb-3 flex items-center gap-2">
          <Radio className="h-4 w-4 text-[var(--b70-text-muted)]" aria-hidden />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[var(--b70-text-muted)]">
            Your automations
          </h2>
        </div>
        <Card className="hover:!translate-y-0 hover:!shadow-none">
          <div className="p-4">
            {bots.length === 0 ? (
              <p className="text-sm text-[var(--b70-text-muted)]">
                No automations yet. Create one to forward scored signals with filters and risk caps.
              </p>
            ) : (
              <ul className="space-y-3">
                {bots.map((bot) => (
                  <li
                    key={bot.id}
                    className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)]/60"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium capitalize text-[var(--b70-text)]">
                            {bot.platform}
                          </span>
                          {bot.is_active ? (
                            <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium uppercase text-emerald-600 dark:text-emerald-400">
                              Live
                            </span>
                          ) : (
                            <span className="rounded-full bg-slate-500/20 px-2 py-0.5 text-[10px] font-medium uppercase text-[var(--b70-text-muted)]">
                              Paused
                            </span>
                          )}
                        </div>
                        <p className="mt-1 truncate text-sm text-[var(--b70-text-accent)]">
                          {bot.channel_id}
                        </p>
                        <p className="mt-1 text-xs text-[var(--b70-text-muted)]">
                          Strategy:{" "}
                          {bot.strategy_id != null
                            ? strategyLabel.get(bot.strategy_id) ?? `#${bot.strategy_id}`
                            : "—"}{" "}
                          · {(bot.signals_sent_24h ?? 0).toLocaleString()} signals since UTC midnight
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button variant="outline" onClick={() => toggleActive(bot)}>
                          {bot.is_active ? "Pause" : "Resume"}
                        </Button>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setEditingId(editingId === bot.id ? null : bot.id);
                            setEditStrategyId((m) => ({
                              ...m,
                              [bot.id]: bot.strategy_id ?? "",
                            }));
                          }}
                        >
                          {editingId === bot.id ? "Close" : "Configure"}
                        </Button>
                        <Button
                          variant="ghost"
                          className="text-rose-500 hover:text-rose-400"
                          onClick={() => handleDelete(bot.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                    {editingId === bot.id && (
                      <div className="space-y-4 border-t border-[var(--b70-border)] p-4">
                        <div>
                          <label className="mb-1 block text-xs font-medium text-[var(--b70-text-muted)]">
                            Linked strategy
                          </label>
                          <select
                            className="max-w-md rounded border border-[var(--b70-border)] bg-[var(--b70-card)] px-3 py-2 text-sm text-[var(--b70-text)]"
                            value={editStrategyId[bot.id] ?? ""}
                            onChange={(e) =>
                              setEditStrategyId((m) => ({
                                ...m,
                                [bot.id]: e.target.value === "" ? "" : Number(e.target.value),
                              }))
                            }
                          >
                            <option value="">None</option>
                            {strategies.map((s) => (
                              <option key={s.id} value={s.id}>
                                {s.strategy_name}
                              </option>
                            ))}
                          </select>
                          <Button
                            variant="outline"
                            className="mt-2"
                            disabled={saving}
                            onClick={async () => {
                              const sid = editStrategyId[bot.id];
                              setSaving(true);
                              try {
                                await updateBot(bot.id, {
                                  strategy_id: sid === "" || sid === undefined ? null : Number(sid),
                                });
                                load();
                              } catch {
                                setError("Failed to save strategy");
                              } finally {
                                setSaving(false);
                              }
                            }}
                          >
                            Save strategy link
                          </Button>
                        </div>
                        <BotSettings
                          config={bot.config_json}
                          onSave={(config) => handleSaveConfig(bot.id, config)}
                          saving={saving}
                        />
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </section>

      <Card className="hover:!translate-y-0 hover:!shadow-none">
        <CardHeader title="How delivery works" />
        <ul className="list-none space-y-2 p-4 text-sm text-[var(--b70-text-muted)]">
          <li className="flex gap-2">
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--b70-text-muted)]" />
            New signals are evaluated against your filters and forwarded to Telegram or Discord (rate
            limits apply per bot).
          </li>
          <li className="flex gap-2">
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--b70-text-muted)]" />
            Link a saved strategy to align alerts with rules you already defined in{" "}
            <Link href="/strategies" className="text-blue-600 hover:underline dark:text-blue-400">
              Strategies
            </Link>
            .
          </li>
          <li className="flex gap-2">
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--b70-text-muted)]" />
            Risk fields are persisted for auditing and future auto-execution; they do not place orders
            today.
          </li>
        </ul>
      </Card>
    </div>
  );
}
