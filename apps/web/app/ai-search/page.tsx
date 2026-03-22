"use client";

import { useState } from "react";
import Link from "next/link";
import { postAISearch, type AISearchResult } from "@/lib/ai-search-api";
import { AIAnswer } from "@/components/ai/ai-answer";
import { SuggestedQuestions } from "@/components/ai/suggested-questions";

export default function AISearchPage() {
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<AISearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const data = await postAISearch(q);
      setResult(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Search failed";
      setError(msg === "Failed to fetch" ? "Unable to reach the server. Please check your connection and try again." : msg);
    } finally {
      setLoading(false);
    }
  }

  function handleSuggested(q: string) {
    setQuery(q);
    setResult(null);
    setError(null);
    setLoading(true);
    postAISearch(q)
      .then(setResult)
      .catch((e) => {
        const msg = e instanceof Error ? e.message : "Search failed";
        setError(msg === "Failed to fetch" ? "Unable to reach the server. Please check your connection and try again." : msg);
      })
      .finally(() => setLoading(false));
  }

  return (
    <div className="mx-auto max-w-3xl space-y-8 p-4">
      <section className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--b70-text)]">
          AI Crypto Search
        </h1>
        <p className="mt-1 text-sm text-[var(--b70-text-muted)]">
          Ask questions about signals, wallets, narratives, and opportunities. Answers use real-time Block70 data.
        </p>
      </section>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="relative">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. What tokens are whales buying?"
            className="w-full rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] py-4 pl-4 pr-32 text-sm text-[var(--b70-text)] placeholder:text-[var(--b70-text-muted)] focus:outline-none focus:ring-2 focus:ring-crypto-blue"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !query.trim()}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-crypto-blue px-4 py-2 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {loading ? "Searching…" : "Search"}
          </button>
        </div>
      </form>

      <SuggestedQuestions onSelect={handleSuggested} />

      {error ? (
        <div className="rounded-xl border border-rose-800/60 bg-rose-950/40 p-4 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      {result ? (
        <section>
          <h2 className="mb-3 text-lg font-semibold text-[var(--b70-text)]">Answer</h2>
          <AIAnswer result={result} />
        </section>
      ) : null}

      <p className="text-xs text-[var(--b70-text-muted)]">
        <Link href="/ai-search/history" className="text-crypto-blue hover:underline">
          View search history
        </Link>
        {" · "}
        <Link href="/signals" className="text-crypto-blue hover:underline">
          Signals
        </Link>
        {" · "}
        <Link href="/copilot" className="text-crypto-blue hover:underline">
          Copilot
        </Link>
      </p>
    </div>
  );
}
