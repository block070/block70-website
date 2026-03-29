"use client";

import { Bell, BellOff, ShieldAlert } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

import type { Opportunity } from "@/lib/types";
import {
  type AirdropPresetId,
  applyAirdropPreset,
  isAirdropRow,
} from "@/lib/airdrop-present";

import { AirdropRewardCard } from "./airdrop-reward-card";
import { EarlySignalsStrip } from "./early-signals-strip";

const SNAPSHOT_KEY = "b70-airdrop-known-ids";
const NOTIFY_PREF_KEY = "b70-airdrop-alerts-opt-in";

type Props = {
  initialOpportunities: Opportunity[];
  backendError: string | null;
};

const PRESETS: { id: AirdropPresetId; label: string; hint: string }[] = [
  { id: "all", label: "All", hint: "Default ranking" },
  { id: "high-value", label: "High value", hint: "Estimated upside first" },
  { id: "low-effort", label: "Low effort", hint: "Easier campaigns" },
  { id: "new", label: "New", hint: "Recently detected" },
];

function readIdSnapshot(): Set<number> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.filter((x) => typeof x === "number"));
  } catch {
    return new Set();
  }
}

function writeIdSnapshot(ids: number[]) {
  localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(ids));
}

export function AirdropsDiscoveryClient({
  initialOpportunities,
  backendError,
}: Props) {
  const [preset, setPreset] = useState<AirdropPresetId>("all");
  const [difficultyFilter, setDifficultyFilter] = useState<string>("");
  const [alertNote, setAlertNote] = useState<string | null>(null);
  const [notifyOptIn, setNotifyOptIn] = useState(false);
  const [newIdsSinceVisit, setNewIdsSinceVisit] = useState<number[]>([]);

  const airdrops = useMemo(
    () => initialOpportunities.filter(isAirdropRow),
    [initialOpportunities],
  );

  const filtered = useMemo(() => {
    let list = applyAirdropPreset(airdrops, preset);
    if (difficultyFilter) {
      list = list.filter(
        (o) =>
          (o.difficulty_level || "").toLowerCase() ===
          difficultyFilter.toLowerCase(),
      );
    }
    return list;
  }, [airdrops, preset, difficultyFilter]);

  useEffect(() => {
    try {
      const pref = localStorage.getItem(NOTIFY_PREF_KEY);
      setNotifyOptIn(pref === "1");
    } catch {
      setNotifyOptIn(false);
    }
  }, []);

  const runNewDropAlert = useCallback(
    (freshIds: number[]) => {
      if (!notifyOptIn || freshIds.length === 0) return;
      if (typeof Notification === "undefined") return;
      if (Notification.permission !== "granted") return;
      try {
        new Notification("Block70: new airdrop listings", {
          body: `${freshIds.length} new entr${freshIds.length === 1 ? "y" : "ies"} since your last snapshot.`,
        });
      } catch {
        /* ignore */
      }
    },
    [notifyOptIn],
  );

  useEffect(() => {
    if (backendError || airdrops.length === 0) return;
    const currentIds = airdrops.map((o) => o.id).sort((a, b) => a - b);
    const prev = readIdSnapshot();
    if (prev.size === 0) {
      writeIdSnapshot(currentIds);
      return;
    }
    const fresh = currentIds.filter((id) => !prev.has(id));
    if (fresh.length > 0) {
      setNewIdsSinceVisit(fresh);
      setAlertNote(
        `${fresh.length} new listing${fresh.length === 1 ? "" : "s"} since your last visit on this device.`,
      );
      runNewDropAlert(fresh);
    }
    writeIdSnapshot(currentIds);
  }, [airdrops, backendError, runNewDropAlert]);

  const requestNotify = async () => {
    if (typeof Notification === "undefined") {
      setAlertNote("Notifications are not supported in this browser.");
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === "granted") {
      setNotifyOptIn(true);
      localStorage.setItem(NOTIFY_PREF_KEY, "1");
      setAlertNote("Experimental: alerts may only work while the site is open in a tab.");
    } else {
      setNotifyOptIn(false);
      localStorage.removeItem(NOTIFY_PREF_KEY);
      setAlertNote("Notification permission was not granted.");
    }
  };

  const disableNotify = () => {
    setNotifyOptIn(false);
    localStorage.removeItem(NOTIFY_PREF_KEY);
    setAlertNote("Browser alerts turned off.");
  };

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-rose-500/20 bg-rose-500/5 p-4">
        <div className="flex gap-2">
          <ShieldAlert className="mt-0.5 size-5 shrink-0 text-rose-300/90" aria-hidden />
          <div>
            <h2 className="text-sm font-semibold text-[var(--b70-text)]">
              Scams are common — DYOR
            </h2>
            <p className="mt-1 text-xs text-[var(--b70-text-muted)]">
              This page is a discovery helper, not financial advice. We do not guarantee rewards,
              tasks, or timelines. Always verify official links and never share seed phrases.
            </p>
          </div>
        </div>
      </section>

      <EarlySignalsStrip />

      <section className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="space-y-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--b70-text-muted)]">
              Presets
            </p>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  disabled={!!backendError}
                  title={p.hint}
                  onClick={() => setPreset(p.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    preset === p.id
                      ? "bg-[var(--b70-crypto-blue)] text-white"
                      : "border border-[var(--b70-border)] bg-slate-900/50 text-[var(--b70-text)] hover:border-slate-600"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] uppercase tracking-wide text-[var(--b70-text-muted)]">
              Refine difficulty
            </label>
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="h-9 rounded-md border border-slate-700 bg-slate-950 px-2 text-xs text-slate-100 outline-none focus:border-emerald-500"
              disabled={!!backendError}
            >
              <option value="">Any (use preset)</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3 rounded-lg border border-slate-800/80 bg-slate-950/40 p-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-xs text-[var(--b70-text-muted)]">
            {notifyOptIn ? (
              <Bell className="mt-0.5 size-4 shrink-0 text-emerald-400" aria-hidden />
            ) : (
              <BellOff className="mt-0.5 size-4 shrink-0 text-slate-500" aria-hidden />
            )}
            <p>
              <span className="font-medium text-[var(--b70-text)]">Experimental alerts: </span>
              optional browser notifications when new listing IDs appear vs. a local snapshot.
              Many browsers require an open tab; this is not email or push infrastructure.
            </p>
          </div>
          <div className="flex shrink-0 gap-2">
            {notifyOptIn ? (
              <button
                type="button"
                onClick={disableNotify}
                className="rounded-md border border-slate-600 px-3 py-1.5 text-xs text-[var(--b70-text)] hover:bg-slate-800"
              >
                Turn off
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void requestNotify()}
                className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-500"
              >
                Enable notifications
              </button>
            )}
          </div>
        </div>

        {alertNote ? (
          <p className="mt-3 text-xs text-amber-200/90">{alertNote}</p>
        ) : null}
        {newIdsSinceVisit.length > 0 ? (
          <p className="mt-1 text-[11px] text-[var(--b70-text-muted)]">
            New IDs: {newIdsSinceVisit.join(", ")}
          </p>
        ) : null}

        {backendError ? (
          <p className="mt-3 text-xs text-rose-300">{backendError}</p>
        ) : null}
      </section>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[var(--b70-border)] bg-[var(--b70-card)]/60 p-8 text-center text-sm text-[var(--b70-text-muted)]">
          {initialOpportunities.length === 0 ? (
            <>
              No airdrop listings were returned from the API. If you run Block70 yourself, ensure the
              airdrop pipeline has populated the database and that the web app can reach FastAPI.
            </>
          ) : (
            <>
              No airdrops match this preset
              {difficultyFilter ? " and difficulty filter" : ""}. Try &quot;All&quot;, clear difficulty,
              or pick another preset.
            </>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((opportunity) => (
            <AirdropRewardCard key={opportunity.id} opportunity={opportunity} />
          ))}
        </div>
      )}
    </div>
  );
}
