"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAISearchHistory } from "@/lib/ai-search-api";
import { getToken } from "@/lib/auth";

export default function AISearchHistoryPage() {
  const [items, setItems] = useState<Awaited<ReturnType<typeof getAISearchHistory>>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAISearchHistory()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const isAuth = typeof window !== "undefined" && !!getToken();

  if (!isAuth) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-4">
        <h1 className="text-2xl font-semibold text-[var(--b70-text)]">AI search history</h1>
        <p className="text-sm text-[var(--b70-text-muted)]">
          Log in to see your previous AI searches.
        </p>
        <Link href="/login" className="inline-block rounded-lg bg-crypto-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90">
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--b70-text)]">AI search history</h1>
        <Link href="/ai-search" className="text-sm font-medium text-crypto-blue hover:underline">
          ← Back to search
        </Link>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--b70-text-muted)]">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-[var(--b70-text-muted)]">
          No search history yet. Your AI searches will appear here when you’re logged in.
        </p>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => (
            <li
              key={item.id}
              className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4"
            >
              <p className="font-medium text-[var(--b70-text)]">{item.query_text}</p>
              {item.response_text ? (
                <p className="mt-1 line-clamp-2 text-xs text-[var(--b70-text-muted)]">
                  {item.response_text}
                </p>
              ) : null}
              <p className="mt-2 text-[11px] text-[var(--b70-text-muted)]">
                {item.created_at ? new Date(item.created_at).toLocaleString() : ""}
                {item.confidence_score != null ? ` · ${(item.confidence_score * 100).toFixed(0)}% confidence` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
