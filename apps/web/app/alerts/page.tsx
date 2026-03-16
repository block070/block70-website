"use client";

import { useEffect, useState } from "react";

import { CreateAlert } from "@/components/opportunities/create-alert";
import { deletePremiumAlert, getPremiumAlerts } from "@/lib/api";

type PremiumAlert = Awaited<ReturnType<typeof getPremiumAlerts>>[number];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<PremiumAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPremiumAlerts();
      setAlerts(data);
    } catch {
      setError("Unable to load alerts from the backend.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleDelete = async (id: number) => {
    setDeletingId(id);
    try {
      await deletePremiumAlert(id);
      setAlerts((prev) => prev.filter((a) => a.id !== id));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section>
        <h2 className="text-lg font-semibold text-slate-50">Alerts</h2>
        <p className="mt-1 text-xs text-slate-400">
          Configure premium rules so Block70 can flag new, high-scoring
          opportunities that matter to you.
        </p>
      </section>

      <CreateAlert />

      <section className="space-y-3">
        <h3 className="text-sm font-medium text-slate-100">
          Existing premium alerts
        </h3>
        {loading ? (
          <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-sm text-slate-400">
            Loading alerts…
          </div>
        ) : error ? (
          <div className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-4 text-sm text-rose-100">
            {error}
          </div>
        ) : alerts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-800 bg-slate-950/60 p-6 text-sm text-slate-400">
            You don&apos;t have any alerts yet. Create one above to start
            monitoring opportunities.
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/80 px-3 py-2 text-xs text-slate-200"
              >
                <div className="space-y-0.5">
                  <p className="font-medium">
                    <span className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] uppercase tracking-wide text-slate-400">
                      {alert.plan_type}
                    </span>{" "}
                    <span className="text-[11px] text-slate-200">
                      {alert.alert_types.join(", ")}
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-400">
                    Minimum score:{" "}
                    <span className="font-semibold text-slate-200">
                      {alert.minimum_score}%
                    </span>
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleDelete(alert.id)}
                  disabled={deletingId === alert.id}
                  className="rounded-full border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-300 hover:border-rose-500 hover:text-rose-300 disabled:opacity-60"
                >
                  {deletingId === alert.id ? "Removing…" : "Remove"}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

