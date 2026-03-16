"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  listApiKeys,
  listWebhooks,
  createApiKey,
  revokeApiKey,
  createWebhook,
  deleteWebhook,
  type ApiKeyInfo,
  type WebhookInfo,
} from "@/lib/developers-api";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const PLAN_LABELS: Record<string, string> = {
  free: "Free (100/day)",
  developer: "Developer (1,000/day)",
  pro: "Pro (10,000/day)",
  elite: "Elite (50,000/day)",
  enterprise: "Enterprise (unlimited)",
};

export default function DevelopersPage() {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvent, setWebhookEvent] = useState("new_signal");
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    Promise.all([listApiKeys(), listWebhooks()])
      .then(([k, w]) => {
        setKeys(k);
        setWebhooks(w);
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleCreateKey = async (planType: string) => {
    setCreating(true);
    setNewKey(null);
    setError(null);
    try {
      const res = await createApiKey(planType);
      setNewKey(res.raw_key);
      load();
    } catch {
      setError("Failed to create key");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: number) => {
    try {
      await revokeApiKey(id);
      load();
    } catch {
      setError("Failed to revoke");
    }
  };

  const handleAddWebhook = async () => {
    if (!webhookUrl.trim()) return;
    setError(null);
    try {
      await createWebhook(webhookUrl.trim(), webhookEvent);
      setWebhookUrl("");
      load();
    } catch {
      setError("Failed to add webhook");
    }
  };

  const handleDeleteWebhook = async (id: number) => {
    try {
      await deleteWebhook(id);
      load();
    } catch {
      setError("Failed to delete webhook");
    }
  };

  if (loading && keys.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-50">Developer dashboard</h1>
        <div className="h-48 animate-pulse rounded bg-[var(--b70-border)]" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-50">Developer dashboard</h1>
        <div className="flex gap-2">
          <Link href="/developers/docs">
            <Button variant="outline">API docs</Button>
          </Link>
          <Link href="/developers/analytics">
            <Button variant="outline">Usage analytics</Button>
          </Link>
        </div>
      </div>

      {error && (
        <p className="rounded bg-rose-500/20 px-3 py-2 text-sm text-rose-400">{error}</p>
      )}

      {newKey && (
        <Card className="border-emerald-500/50 bg-emerald-500/10">
          <div className="p-4">
            <p className="mb-2 text-sm font-medium text-slate-300">New API key (copy now; it won’t be shown again):</p>
            <code className="block break-all rounded bg-slate-900 px-2 py-2 text-sm text-emerald-300">{newKey}</code>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title="API keys"
          subtitle="Use X-API-Key header for developer API requests. Rate limits apply by plan."
        />
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap gap-2">
            {(["free", "developer", "pro"] as const).map((plan) => (
              <Button
                key={plan}
                disabled={creating}
                onClick={() => handleCreateKey(plan)}
              >
                Create {plan}
              </Button>
            ))}
          </div>
          {keys.length === 0 ? (
            <p className="text-slate-500">No API keys yet.</p>
          ) : (
            <ul className="space-y-2">
              {keys.map((k) => (
                <li
                  key={k.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-[var(--b70-border)] bg-slate-900/50 px-3 py-2"
                >
                  <span className="font-mono text-slate-300">{k.key_prefix}…</span>
                  <span className="text-sm text-slate-400">{PLAN_LABELS[k.plan_type] ?? k.plan_type}</span>
                  <span className="text-sm text-slate-500">
                    {k.usage_today} / {k.rate_limit === 0 ? "∞" : k.rate_limit} today
                  </span>
                  {k.is_active ? (
                    <Button
                      variant="ghost"
                      className="text-xs text-rose-400"
                      onClick={() => handleRevoke(k.id)}
                    >
                      Revoke
                    </Button>
                  ) : (
                    <span className="text-xs text-slate-500">Revoked</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Webhooks"
          subtitle="Register URLs to receive POST requests for new_signal, wallet_trade, opportunity_alert."
        />
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap gap-2">
            <input
              type="url"
              placeholder="https://your-server.com/webhook"
              className="rounded border border-[var(--b70-border)] bg-slate-900 px-3 py-2 text-sm text-slate-100"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
            />
            <select
              className="rounded border border-[var(--b70-border)] bg-slate-900 px-3 py-2 text-sm text-slate-100"
              value={webhookEvent}
              onChange={(e) => setWebhookEvent(e.target.value)}
            >
              <option value="new_signal">new_signal</option>
              <option value="wallet_trade">wallet_trade</option>
              <option value="opportunity_alert">opportunity_alert</option>
            </select>
            <Button onClick={handleAddWebhook}>Add webhook</Button>
          </div>
          {webhooks.length === 0 ? (
            <p className="text-slate-500">No webhooks.</p>
          ) : (
            <ul className="space-y-2">
              {webhooks.map((w) => (
                <li
                  key={w.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded border border-[var(--b70-border)] px-3 py-2"
                >
                  <span className="text-sm text-slate-300">{w.url}</span>
                  <span className="text-xs text-slate-500">{w.event_type}</span>
                  <Button
                    variant="ghost"
                    className="text-xs text-rose-400"
                    onClick={() => handleDeleteWebhook(w.id)}
                  >
                    Delete
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      <Card>
        <CardHeader title="Developer API base URL" subtitle="Use this base for all developer endpoints." />
        <div className="p-4">
          <code className="text-sm text-slate-400">
            {typeof window !== "undefined"
              ? (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000") + "/api/v1/dev"
              : "/api/v1/dev"}
          </code>
          <p className="mt-2 text-xs text-slate-500">
            Example: GET /api/v1/dev/signals with header X-API-Key: your_key
          </p>
        </div>
      </Card>
    </div>
  );
}
