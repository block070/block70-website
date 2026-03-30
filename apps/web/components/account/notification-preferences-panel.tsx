"use client";

import { useEffect, useState } from "react";
import {
  getNotificationPreferences,
  patchNotificationPreferences,
  type NotificationPrefs,
} from "@/lib/notifications-api";

const LABELS: { key: keyof NotificationPrefs; label: string; hint?: string }[] = [
  { key: "email_digest", label: "Daily digest email" },
  { key: "email_realtime", label: "Real-time alert emails", hint: "Capped per day per account." },
  { key: "email_marketing", label: "Product & re-engagement email" },
  { key: "push_enabled", label: "Push (Web Push coming soon; reserved)" },
  { key: "notify_signal", label: "Signals" },
  { key: "notify_narrative", label: "Narrative shifts" },
  { key: "notify_opportunity", label: "Opportunities" },
  { key: "notify_whale", label: "Whale / smart-money highlights" },
  { key: "notify_trial", label: "Trial ending reminders" },
  { key: "notify_reengage", label: "We-miss-you nudges" },
];

export function NotificationPreferencesPanel() {
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    void getNotificationPreferences()
      .then(setPrefs)
      .catch(() => setErr("Could not load preferences"))
      .finally(() => setLoading(false));
  }, []);

  async function toggle(key: keyof NotificationPrefs) {
    if (!prefs) return;
    const next = { ...prefs, [key]: !prefs[key] };
    setPrefs(next);
    setErr(null);
    try {
      const saved = await patchNotificationPreferences({ [key]: next[key] });
      setPrefs(saved);
    } catch {
      setErr("Save failed");
      setPrefs(prefs);
    }
  }

  if (loading) {
    return <p className="text-xs text-slate-400">Loading notification settings…</p>;
  }
  if (!prefs) {
    return <p className="text-xs text-rose-400">{err ?? "Unavailable"}</p>;
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-950/60 p-4 text-xs">
      <p className="font-medium text-slate-200">Notifications</p>
      <p className="text-slate-400">
        Control email topics. Real-time sends respect a daily limit server-side.
      </p>
      {err ? <p className="text-rose-400">{err}</p> : null}
      <ul className="space-y-2">
        {LABELS.map(({ key, label, hint }) => (
          <li key={key}>
            <label className="flex cursor-pointer items-start gap-2">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-slate-600"
                checked={prefs[key]}
                onChange={() => void toggle(key)}
              />
              <span>
                <span className="text-slate-200">{label}</span>
                {hint ? <span className="block text-[10px] text-slate-500">{hint}</span> : null}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}
