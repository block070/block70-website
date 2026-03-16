"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  listBots,
  createBot,
  updateBot,
  deleteBot,
  type BotInfo,
  type BotConfig,
} from "@/lib/bots-api";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BotSettings } from "@/components/bots/bot-settings";

export default function BotsPage() {
  const [bots, setBots] = useState<BotInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newPlatform, setNewPlatform] = useState<"telegram" | "discord">("telegram");
  const [newToken, setNewToken] = useState("");
  const [newChannelId, setNewChannelId] = useState("");

  const load = () => {
    setLoading(true);
    listBots()
      .then(setBots)
      .catch(() => setError("Failed to load bots"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

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
      setError("Token and channel ID are required");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createBot({
        platform: newPlatform,
        bot_token: newToken.trim(),
        channel_id: newChannelId.trim(),
      });
      setShowAdd(false);
      setNewToken("");
      setNewChannelId("");
      load();
    } catch {
      setError("Failed to create bot");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this bot?")) return;
    try {
      await deleteBot(id);
      load();
    } catch {
      setError("Failed to delete");
    }
  };

  if (loading && bots.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-50">Signal bots</h1>
        <div className="h-48 animate-pulse rounded bg-[var(--b70-border)]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-50">Signal bots</h1>
        <Button onClick={() => setShowAdd(!showAdd)}>
          {showAdd ? "Cancel" : "Add bot"}
        </Button>
      </div>

      {error && (
        <p className="rounded bg-rose-500/20 px-3 py-2 text-sm text-rose-400">
          {error}
        </p>
      )}

      {showAdd && (
        <Card>
          <CardHeader title="Connect a bot" subtitle="Telegram Bot API or Discord webhook" />
          <div className="space-y-4 p-4">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Platform</label>
              <select
                className="rounded border border-[var(--b70-border)] bg-slate-900 px-3 py-2 text-sm text-slate-100"
                value={newPlatform}
                onChange={(e) => setNewPlatform(e.target.value as "telegram" | "discord")}
              >
                <option value="telegram">Telegram</option>
                <option value="discord">Discord (webhook URL)</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">
                {newPlatform === "discord" ? "Webhook URL" : "Bot token"}
              </label>
              <input
                type="password"
                placeholder={newPlatform === "discord" ? "https://discord.com/api/webhooks/..." : "123456:ABC..."}
                className="w-full rounded border border-[var(--b70-border)] bg-slate-900 px-3 py-2 text-sm text-slate-100"
                value={newToken}
                onChange={(e) => setNewToken(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">
                {newPlatform === "discord" ? "Channel (optional)" : "Channel ID (@channel or -100...)"}
              </label>
              <input
                type="text"
                placeholder={newPlatform === "telegram" ? "-1001234567890 or @mychannel" : ""}
                className="w-full rounded border border-[var(--b70-border)] bg-slate-900 px-3 py-2 text-sm text-slate-100"
                value={newChannelId}
                onChange={(e) => setNewChannelId(e.target.value)}
              />
            </div>
            <Button onClick={handleCreate} disabled={saving}>
              {saving ? "Adding…" : "Add bot"}
            </Button>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Active bots"
          subtitle="Connected channels and signal activity (max 10 signals/hour per bot)"
        />
        <div className="p-4">
          {bots.length === 0 ? (
            <p className="text-slate-500">No bots yet. Add a Telegram bot or Discord webhook.</p>
          ) : (
            <ul className="space-y-4">
              {bots.map((bot) => (
                <li
                  key={bot.id}
                  className="rounded-lg border border-[var(--b70-border)] bg-slate-900/50 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-medium text-slate-200 capitalize">{bot.platform}</span>
                      <span className="ml-2 text-sm text-slate-500">{bot.channel_id}</span>
                      {!bot.is_active && (
                        <span className="ml-2 text-xs text-amber-400">(paused)</span>
                      )}
                    </div>
                    <span className="text-sm text-slate-400">
                      {bot.signals_sent_24h ?? 0} signals (24h)
                    </span>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setEditingId(editingId === bot.id ? null : bot.id)}
                      >
                        {editingId === bot.id ? "Close" : "Settings"}
                      </Button>
                      <Button
                        variant="ghost"
                        className="text-rose-400"
                        onClick={() => handleDelete(bot.id)}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                  {editingId === bot.id && (
                    <div className="mt-4 border-t border-[var(--b70-border)] pt-4">
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

      <Card>
        <CardHeader title="How it works" />
        <div className="space-y-2 p-4 text-sm text-slate-400">
          <p>• New signals are sent to your connected channels every minute.</p>
          <p>• Rate limit: 10 signals per hour per bot to prevent spam.</p>
          <p>• Use Settings to filter by signal type, confidence, and tokens.</p>
          <p>
            • Telegram: create a bot with @BotFather, get the token, add the bot to your channel,
            use the channel ID (e.g. @channel or -100...).
          </p>
          <p>• Discord: create a webhook in channel settings and paste the URL.</p>
        </div>
      </Card>
    </div>
  );
}
