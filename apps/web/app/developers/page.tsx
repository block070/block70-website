"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Check, Copy, KeyRound, Loader2 } from "lucide-react";
import {
  listApiKeys,
  listWebhooks,
  createApiKey,
  revokeApiKey,
  updateApiKey,
  createWebhook,
  deleteWebhook,
  type ApiKeyInfo,
  type ApiKeyScopes,
  type WebhookInfo,
} from "@/lib/developers-api";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PaywallSection } from "@/components/paywall/paywall-section";

const PLAN_LABELS: Record<string, string> = {
  free: "Free — 100 req/day",
  developer: "Developer — 1,000/day",
  pro: "Pro — 10,000/day",
  elite: "Elite — 50,000/day",
  quant: "Quant — unlimited (API access)",
  enterprise: "Enterprise — unlimited",
};

const DEFAULT_NEW_SCOPES: ApiKeyScopes = {
  read: true,
  write: false,
  trading: false,
};

function scopeBadges(s: ApiKeyScopes) {
  const bits: string[] = [];
  if (s.read) bits.push("Read");
  if (s.write) bits.push("Write");
  if (s.trading) bits.push("Trading");
  return bits.join(" · ") || "—";
}

function CopyField({ value, label }: { value: string; label: string }) {
  const [done, setDone] = useState(false);
  const copy = () => {
    void navigator.clipboard.writeText(value).then(() => {
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    });
  };
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      <div className="flex items-center gap-2 rounded-md border border-slate-700 bg-slate-950/80 pl-3 pr-1 py-1">
        <code className="min-w-0 flex-1 truncate text-xs text-emerald-200">{value}</code>
        <Button type="button" variant="ghost" className="h-8 shrink-0 px-2" onClick={copy}>
          {done ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}

export default function DevelopersPage() {
  const [keys, setKeys] = useState<ApiKeyInfo[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  const [webhookUrl, setWebhookUrl] = useState("");
  const [webhookEvent, setWebhookEvent] = useState("new_signal");
  const [error, setError] = useState<string | null>(null);

  const [createLabel, setCreateLabel] = useState("");
  const [createScopes, setCreateScopes] = useState<ApiKeyScopes>({ ...DEFAULT_NEW_SCOPES });
  const [createIps, setCreateIps] = useState("");

  const [editing, setEditing] = useState<ApiKeyInfo | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editScopes, setEditScopes] = useState<ApiKeyScopes>(DEFAULT_NEW_SCOPES);
  const [editIps, setEditIps] = useState("");
  const [editRateLimit, setEditRateLimit] = useState<string>("");
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([listApiKeys(), listWebhooks()])
      .then(([k, w]) => {
        setKeys(k);
        setWebhooks(w);
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openEdit = (k: ApiKeyInfo) => {
    setEditing(k);
    setEditLabel(k.key_label ?? "");
    setEditScopes({ ...k.scopes });
    setEditIps((k.ip_allowlist ?? []).join("\n"));
    setEditRateLimit(String(k.rate_limit));
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSavingEdit(true);
    setError(null);
    try {
      const lines = editIps
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const rl = parseInt(editRateLimit.trim(), 10);
      await updateApiKey(editing.id, {
        label: editLabel.trim() || null,
        scopes: { ...editScopes },
        ip_allowlist: lines.length ? lines : [],
        rate_limit: Number.isFinite(rl) && rl >= 0 ? rl : undefined,
      });
      setEditing(null);
      load();
    } catch {
      setError("Failed to save key settings");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleCreateKey = async () => {
    setCreating(true);
    setNewKey(null);
    setError(null);
    try {
      const lines = createIps
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean);
      const res = await createApiKey({
        plan_type: "quant",
        label: createLabel.trim() || null,
        scopes: { ...createScopes },
        ip_allowlist: lines.length ? lines : null,
      });
      setNewKey(res.raw_key);
      setCreateLabel("");
      setCreateIps("");
      setCreateScopes({ ...DEFAULT_NEW_SCOPES });
      load();
    } catch {
      setError("Failed to create key");
    } finally {
      setCreating(false);
    }
  };

  const handleRevoke = async (id: number) => {
    if (!confirm("Revoke this key? Apps using it will fail immediately.")) return;
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

  const baseUrl =
    typeof window !== "undefined"
      ? `${process.env.NEXT_PUBLIC_API_BASE_URL ?? ""}/api/v1/dev`
      : "/api/v1/dev";

  if (loading && keys.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-50">API keys</h1>
        <div className="h-48 animate-pulse rounded bg-[var(--b70-border)]" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Developers
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-50">
            API keys & access
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-400">
            Manage secret keys for the Block70 developer API. Keys grant access to your account
            data; treat them like passwords.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/apidocs">
            <Button variant="outline" className="px-3 py-1.5 text-xs">
              API reference
            </Button>
          </Link>
          <Link href="/developers/analytics">
            <Button variant="outline" className="px-3 py-1.5 text-xs">
              Usage & errors
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div>
          <p className="font-medium text-amber-50">Security</p>
          <p className="mt-1 text-amber-100/90">
            Each full secret is shown only once after creation. Use IP restrictions in production.
            <span className="text-amber-200/80"> Trading</span> permission is required for{" "}
            <code className="rounded bg-slate-900/80 px-1 text-xs">/portfolio</code> and{" "}
            <code className="rounded bg-slate-900/80 px-1 text-xs">/strategies</code> routes.
          </p>
        </div>
      </div>

      {error && (
        <p className="rounded border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          {error}
        </p>
      )}

      {newKey && (
        <Card className="border-emerald-500/40 bg-emerald-950/20">
          <div className="space-y-3 p-4">
            <p className="text-sm font-medium text-emerald-100">
              Copy your secret now — you won&apos;t see it again.
            </p>
            <CopyField value={newKey} label="Secret key" />
          </div>
        </Card>
      )}

      <PaywallSection
        feature="api_access"
        title="Developer API keys"
        subtitle="Create and manage REST API keys on the Quant plan. Unlock programmatic market, signals, and wallet data."
      >
      <Card>
        <CardHeader
          title="Create a key"
          subtitle={PLAN_LABELS.quant}
        />
        <div className="space-y-4 p-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Name (optional)</label>
              <input
                className="w-full rounded-md border border-[var(--b70-border)] bg-slate-950 px-3 py-2 text-sm text-slate-100"
                placeholder="Production / CI / Local"
                value={createLabel}
                onChange={(e) => setCreateLabel(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-400">Rate tier</label>
              <p className="rounded-md border border-[var(--b70-border)] bg-slate-950/80 px-3 py-2 text-sm text-slate-300">
                {PLAN_LABELS.quant}
              </p>
            </div>
          </div>

          <div>
            <p className="mb-2 text-xs font-medium text-slate-400">Permissions</p>
            <div className="flex flex-wrap gap-4">
              {(
                [
                  ["read", "Read", "List signals, market, wallets, airdrops, etc."],
                  ["write", "Write", "Future mutation endpoints"],
                  ["trading", "Trading", "Portfolio & your strategies"],
                ] as const
              ).map(([key, title, hint]) => (
                <label
                  key={key}
                  className="flex cursor-pointer items-start gap-2 rounded-md border border-slate-800 bg-slate-900/50 px-3 py-2"
                >
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={createScopes[key]}
                    onChange={(e) =>
                      setCreateScopes((s) => ({ ...s, [key]: e.target.checked }))
                    }
                  />
                  <span>
                    <span className="block text-sm font-medium text-slate-200">{title}</span>
                    <span className="block text-xs text-slate-500">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-400">
              IP allowlist (optional)
            </label>
            <textarea
              className="min-h-[80px] w-full rounded-md border border-[var(--b70-border)] bg-slate-950 px-3 py-2 font-mono text-xs text-slate-200"
              placeholder={"One IPv4/IPv6 or CIDR per line, e.g.\n203.0.113.10\n10.0.0.0/8"}
              value={createIps}
              onChange={(e) => setCreateIps(e.target.value)}
            />
            <p className="mt-1 text-xs text-slate-500">Empty = allow all IPs.</p>
          </div>

          <Button onClick={handleCreateKey} disabled={creating || !createScopes.read}>
            {creating ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              <>
                <KeyRound className="mr-2 h-4 w-4" />
                Create API key
              </>
            )}
          </Button>
          {!createScopes.read && (
            <p className="text-xs text-rose-400">Read must be enabled for API access.</p>
          )}
        </div>
      </Card>
      </PaywallSection>

      <Card>
        <CardHeader title="Active keys" subtitle="Prefix, usage today, and restrictions" />
        <div className="p-4">
          {keys.length === 0 ? (
            <p className="text-sm text-slate-500">No keys yet. Create one above.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[var(--b70-border)] text-left text-slate-500">
                    <th className="pb-2 pr-3 font-medium">Name</th>
                    <th className="pb-2 pr-3 font-medium">Key</th>
                    <th className="pb-2 pr-3 font-medium">Plan</th>
                    <th className="pb-2 pr-3 font-medium">Scopes</th>
                    <th className="pb-2 pr-3 font-medium text-right">Today</th>
                    <th className="pb-2 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => (
                    <tr key={k.id} className="border-b border-slate-800/80">
                      <td className="py-2 pr-3 text-slate-200">
                        {k.key_label || (
                          <span className="text-slate-500">—</span>
                        )}
                      </td>
                      <td className="py-2 pr-3 font-mono text-slate-300">{k.key_prefix}…</td>
                      <td className="py-2 pr-3 text-slate-400">{k.plan_type}</td>
                      <td className="py-2 pr-3 text-xs text-slate-500">{scopeBadges(k.scopes)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums text-slate-300">
                        {k.usage_today} / {k.rate_limit === 0 ? "∞" : k.rate_limit}
                      </td>
                      <td className="py-2 text-right">
                        {k.is_active ? (
                          <div className="flex justify-end gap-1">
                            <Button variant="outline" className="h-8 text-xs" onClick={() => openEdit(k)}>
                              Edit
                            </Button>
                            <Button
                              variant="ghost"
                              className="h-8 text-xs text-rose-400 hover:text-rose-300"
                              onClick={() => handleRevoke(k.id)}
                            >
                              Revoke
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-600">Revoked</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>

      {editing && (
        <Card className="border-[var(--b70-crypto-blue)]/30">
          <CardHeader title={`Edit key ${editing.key_prefix}…`} />
          <div className="space-y-4 p-4">
            <div>
              <label className="mb-1 block text-xs text-slate-400">Name</label>
              <input
                className="w-full max-w-md rounded-md border border-[var(--b70-border)] bg-slate-950 px-3 py-2 text-sm"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-4">
              {(
                [
                  ["read", "Read"],
                  ["write", "Write"],
                  ["trading", "Trading"],
                ] as const
              ).map(([key, title]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    checked={editScopes[key]}
                    onChange={(e) =>
                      setEditScopes((s) => ({ ...s, [key]: e.target.checked }))
                    }
                  />
                  {title}
                </label>
              ))}
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">IP allowlist</label>
              <textarea
                className="min-h-[80px] w-full max-w-lg rounded-md border border-[var(--b70-border)] bg-slate-950 px-3 py-2 font-mono text-xs"
                value={editIps}
                onChange={(e) => setEditIps(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">
                Daily request limit (0 = unlimited)
              </label>
              <input
                type="number"
                min={0}
                className="w-full max-w-xs rounded-md border border-[var(--b70-border)] bg-slate-950 px-3 py-2 text-sm"
                value={editRateLimit}
                onChange={(e) => setEditRateLimit(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={saveEdit} disabled={savingEdit || !editScopes.read}>
                {savingEdit ? "Saving…" : "Save changes"}
              </Button>
              <Button variant="outline" onClick={() => setEditing(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      )}

      <Card>
        <CardHeader
          title="Webhooks"
          subtitle="POST callbacks for signals and alerts (separate from API keys)."
        />
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap gap-2">
            <input
              type="url"
              placeholder="https://your-server.com/webhook"
              className="min-w-[200px] flex-1 rounded border border-[var(--b70-border)] bg-slate-900 px-3 py-2 text-sm text-slate-100"
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
        <CardHeader title="Base URL" subtitle="Send X-API-Key on every request." />
        <div className="p-4">
          <CopyField value={baseUrl} label="Developer API base" />
          <p className="mt-3 text-xs text-slate-500">
            Example: <code className="text-slate-400">GET {baseUrl}/signals</code> with header{" "}
            <code className="text-slate-400">X-API-Key: bk70_…</code>
          </p>
        </div>
      </Card>
    </div>
  );
}
