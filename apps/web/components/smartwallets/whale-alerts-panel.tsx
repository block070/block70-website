"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

import {
  getWhaleAlertPresets,
  setWhaleAlertPresets,
  type WhaleAlertPreset,
} from "@/lib/whale-watchlist";

export function WhaleAlertsPanel() {
  const [presets, setPresets] = useState<WhaleAlertPreset[]>([]);

  const refresh = useCallback(() => {
    setPresets(getWhaleAlertPresets());
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const toggle = (id: string) => {
    const next = presets.map((p) =>
      p.id === id ? { ...p, enabled: !p.enabled } : p,
    );
    setWhaleAlertPresets(next);
    setPresets(next);
  };

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--b70-text-muted)]">
        Presets are stored on this device. For account-level notifications, use{" "}
        <Link href="/alerts" className="text-[var(--b70-crypto-blue)] hover:underline">
          Alerts
        </Link>{" "}
        and{" "}
        <Link href="/copilot" className="text-[var(--b70-crypto-blue)] hover:underline">
          Copilot
        </Link>{" "}
        when signed in.
      </p>
      <ul className="space-y-2">
        {presets.map((p) => (
          <li
            key={p.id}
            className="flex items-center justify-between gap-3 rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)]/60 px-3 py-2"
          >
            <div>
              <p className="text-sm text-[var(--b70-text)]">{p.label}</p>
              {p.minTransferUsd > 0 ? (
                <p className="text-[11px] text-[var(--b70-text-muted)]">
                  Threshold: ${p.minTransferUsd.toLocaleString()}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={p.enabled}
              onClick={() => toggle(p.id)}
              className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${
                p.enabled ? "bg-emerald-600/80" : "bg-[var(--b70-border)]"
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-transform ${
                  p.enabled ? "left-5" : "left-0.5"
                }`}
              />
            </button>
          </li>
        ))}
      </ul>
      {!presets.some((p) => p.enabled) ? (
        <p className="text-[11px] text-[var(--b70-text-muted)]">
          Enable a preset to express intent; server-side delivery hooks into premium / notification systems can
          be wired separately.
        </p>
      ) : null}
    </div>
  );
}
