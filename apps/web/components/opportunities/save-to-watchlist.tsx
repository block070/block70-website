"use client";

import { useEffect, useState } from "react";

import type { Opportunity } from "@/lib/types";

type Props = {
  opportunity: Opportunity;
};

const STORAGE_KEY = "block70_watchlist_opportunity_ids";

function loadWatchlistIds(): number[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v) => typeof v === "number") : [];
  } catch {
    return [];
  }
}

function saveWatchlistIds(ids: number[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
}

export function SaveToWatchlist({ opportunity }: Props) {
  const [savedIds, setSavedIds] = useState<number[]>([]);

  useEffect(() => {
    setSavedIds(loadWatchlistIds());
  }, []);

  const isSaved = savedIds.includes(opportunity.id);

  const toggle = () => {
    setSavedIds((prev) => {
      const next = prev.includes(opportunity.id)
        ? prev.filter((id) => id !== opportunity.id)
        : [...prev, opportunity.id];
      saveWatchlistIds(next);
      return next;
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
        isSaved
          ? "border-emerald-500/70 bg-emerald-500/15 text-emerald-200"
          : "border-slate-700 bg-slate-900/70 text-slate-300 hover:border-emerald-500/60 hover:text-emerald-200"
      }`}
    >
      <span className="inline-block h-2 w-2 rounded-full bg-current" />
      {isSaved ? "Saved to watchlist" : "Save to watchlist"}
    </button>
  );
}

