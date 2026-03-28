"use client";

import { useEffect, useState } from "react";
import { Rss } from "lucide-react";

import { getNewsArticles } from "@/lib/api";
import type { NewsArticleSummary } from "@/lib/api";

const KEYWORDS = /\b(airdrop|testnet|points?\s+program|incentive|retroactive|claim)\b/i;

function matchesEarlySignal(item: NewsArticleSummary): boolean {
  const t = `${item.title} ${item.summary ?? ""} ${item.body_text ?? ""}`;
  return KEYWORDS.test(t);
}

export function EarlySignalsStrip() {
  const [items, setItems] = useState<NewsArticleSummary[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">(
    "idle",
  );

  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    getNewsArticles({ limit: 40 })
      .then((all) => {
        if (cancelled) return;
        setItems(all.filter(matchesEarlySignal).slice(0, 12));
        setStatus("done");
      })
      .catch(() => {
        if (cancelled) return;
        setItems([]);
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (status === "loading") {
    return (
      <section className="rounded-xl border border-dashed border-[var(--b70-border)] bg-[var(--b70-card)]/60 p-4">
        <p className="text-xs text-[var(--b70-text-muted)]">Loading early signals…</p>
      </section>
    );
  }

  if (status === "error" || items.length === 0) {
    return null;
  }

  return (
    <section className="space-y-3 rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Rss className="size-4 text-amber-400/90" aria-hidden />
        <h3 className="text-sm font-semibold text-[var(--b70-text)]">
          Early signals from news
        </h3>
      </div>
      <p className="text-xs text-amber-200/80">
        News and rumors — not confirmed airdrops. Treat as noise until you verify primary sources.
      </p>
      <div className="-mx-1 flex gap-3 overflow-x-auto pb-1">
        {items.map((article) => (
          <a
            key={`${article.id}-${article.url}`}
            href={article.url}
            target="_blank"
            rel="noreferrer noopener"
            className="min-w-[220px] max-w-[280px] shrink-0 rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)] p-3 text-xs hover:border-slate-600"
          >
            <p className="line-clamp-3 font-medium text-[var(--b70-text)]">
              {article.title}
            </p>
            <p className="mt-2 text-[10px] text-[var(--b70-text-muted)]">
              {article.source}
            </p>
          </a>
        ))}
      </div>
    </section>
  );
}
