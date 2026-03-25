"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  createExchangeAffiliateLink,
  deleteExchangeAffiliateLink,
  listExchangeAffiliateLinks,
  type ExchangeAffiliateRow,
  upsertExchangeAffiliateLink,
} from "@/lib/admin-api";
import { Button } from "@/components/ui/button";

export default function AdminAffiliatesPage() {
  const [items, setItems] = useState<ExchangeAffiliateRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [form, setForm] = useState({
    display_name: "",
    venue_type: "cex",
    url_template: "",
    is_active: true,
    notes: "",
  });
  const [newKey, setNewKey] = useState("");
  const [newForm, setNewForm] = useState({
    display_name: "",
    venue_type: "dex",
    url_template: "",
    is_active: true,
    notes: "",
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setError(null);
    return listExchangeAffiliateLinks()
      .then((r) => setItems(r.items))
      .catch((e) => setError(e instanceof Error ? e.message : "Forbidden"));
  }, []);

  useEffect(() => {
    load().finally(() => setLoading(false));
  }, [load]);

  function startEdit(row: ExchangeAffiliateRow) {
    setEditingKey(row.provider_key);
    setForm({
      display_name: row.display_name,
      venue_type: row.venue_type || "cex",
      url_template: row.url_template ?? "",
      is_active: row.is_active,
      notes: row.notes ?? "",
    });
  }

  async function saveEdit(providerKey: string) {
    setSaving(true);
    setError(null);
    try {
      await upsertExchangeAffiliateLink(providerKey, {
        display_name: form.display_name,
        venue_type: form.venue_type,
        url_template: form.url_template.trim() || null,
        is_active: form.is_active,
        notes: form.notes.trim() || null,
      });
      setEditingKey(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function addVenue() {
    const pk = newKey.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!pk || !newForm.display_name.trim()) {
      setError("New venue: provider_key (letters, numbers, underscore) and display name are required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await createExchangeAffiliateLink({
        provider_key: pk,
        display_name: newForm.display_name.trim(),
        venue_type: newForm.venue_type,
        url_template: newForm.url_template.trim() || null,
        is_active: newForm.is_active,
        notes: newForm.notes.trim() || null,
      });
      setNewKey("");
      setNewForm({
        display_name: "",
        venue_type: "dex",
        url_template: "",
        is_active: true,
        notes: "",
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  async function removeVenue(providerKey: string) {
    if (!confirm(`Delete affiliate row "${providerKey}"?`)) return;
    setSaving(true);
    setError(null);
    try {
      await deleteExchangeAffiliateLink(providerKey);
      if (editingKey === providerKey) setEditingKey(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-50">Exchange affiliates</h1>
        <div className="h-48 animate-pulse rounded bg-slate-800/50" />
      </div>
    );
  }

  if (error && !items.length) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-slate-50">Exchange affiliates</h1>
        <p className="text-rose-400">{error}</p>
        <p className="text-sm text-slate-500">Admin access required.</p>
        <Link href="/dashboard">
          <Button>Back to dashboard</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <Link href="/admin/analytics">
          <Button variant="outline">← Analytics</Button>
        </Link>
        <Link href="/admin/bots">
          <Button variant="outline">Bots</Button>
        </Link>
        <h1 className="text-2xl font-bold text-slate-50">Exchange affiliate links</h1>
      </div>

      <p className="max-w-2xl text-sm text-slate-400">
        When <strong className="text-slate-200">URL template</strong> is filled and the row is active, the
        public site uses it instead of the default deep link for that{" "}
        <code className="rounded bg-slate-800 px-1">provider_key</code>. Use placeholders{" "}
        <code className="rounded bg-slate-800 px-1">{"{slug}"}</code>,{" "}
        <code className="rounded bg-slate-800 px-1">{"{base}"}</code> (uppercase ticker for paths),{" "}
        <code className="rounded bg-slate-800 px-1">{"{slugEncoded}"}</code> if you need query encoding.
        Keys <code className="rounded bg-slate-800 px-1">coinbase</code>,{" "}
        <code className="rounded bg-slate-800 px-1">binance_us</code>,{" "}
        <code className="rounded bg-slate-800 px-1">kraken</code> power the main “Buy” buttons.
      </p>

      {error ? <p className="text-sm text-amber-400">{error}</p> : null}

      <section className="rounded-xl border border-slate-800 bg-slate-950/50 p-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-200">Add venue</h2>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <input
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            placeholder="provider_key (e.g. okx)"
            value={newKey}
            onChange={(e) => setNewKey(e.target.value)}
          />
          <input
            className="min-w-[140px] flex-1 rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            placeholder="Display name"
            value={newForm.display_name}
            onChange={(e) => setNewForm((f) => ({ ...f, display_name: e.target.value }))}
          />
          <select
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
            value={newForm.venue_type}
            onChange={(e) => setNewForm((f) => ({ ...f, venue_type: e.target.value }))}
          >
            <option value="cex">CEX</option>
            <option value="dex">DEX</option>
            <option value="other">Other</option>
          </select>
          <Button type="button" onClick={() => void addVenue()} disabled={saving}>
            Add
          </Button>
        </div>
        <textarea
          className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-slate-100"
          placeholder="URL template (optional until you have an affiliate link)"
          rows={2}
          value={newForm.url_template}
          onChange={(e) => setNewForm((f) => ({ ...f, url_template: e.target.value }))}
        />
      </section>

      <div className="space-y-4">
        {items.map((row) => (
          <div
            key={row.provider_key}
            className="rounded-xl border border-slate-800 bg-slate-900/40 p-4"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-mono text-sm font-semibold text-emerald-400">{row.provider_key}</p>
                <p className="text-xs text-slate-500">
                  {row.display_name} · {row.venue_type}
                  {row.is_active ? "" : " · inactive"}
                </p>
              </div>
              <div className="flex gap-2">
                {editingKey === row.provider_key ? (
                  <Button type="button" variant="outline" onClick={() => setEditingKey(null)}>
                    Cancel
                  </Button>
                ) : (
                  <Button type="button" variant="outline" onClick={() => startEdit(row)}>
                    Edit
                  </Button>
                )}
                <Button
                  type="button"
                  variant="outline"
                  className="border-rose-800 text-rose-300 hover:bg-rose-950/50"
                  onClick={() => void removeVenue(row.provider_key)}
                  disabled={saving}
                >
                  Delete
                </Button>
              </div>
            </div>

            {editingKey === row.provider_key ? (
              <div className="mt-3 space-y-2 border-t border-slate-800 pt-3">
                <input
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  value={form.display_name}
                  onChange={(e) => setForm((f) => ({ ...f, display_name: e.target.value }))}
                />
                <select
                  className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  value={form.venue_type}
                  onChange={(e) => setForm((f) => ({ ...f, venue_type: e.target.value }))}
                >
                  <option value="cex">CEX</option>
                  <option value="dex">DEX</option>
                  <option value="other">Other</option>
                </select>
                <label className="flex items-center gap-2 text-sm text-slate-300">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                  />
                  Active (inactive rows do not override public URLs)
                </label>
                <textarea
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 font-mono text-xs text-slate-100"
                  rows={3}
                  placeholder="Affiliate / deep URL template"
                  value={form.url_template}
                  onChange={(e) => setForm((f) => ({ ...f, url_template: e.target.value }))}
                />
                <input
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-slate-100"
                  placeholder="Internal notes (not public)"
                  value={form.notes}
                  onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                />
                <Button type="button" onClick={() => void saveEdit(row.provider_key)} disabled={saving}>
                  Save
                </Button>
              </div>
            ) : (
              <p className="mt-2 break-all font-mono text-xs text-slate-500">
                {row.url_template?.trim() || "(default site URL — no override)"}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
