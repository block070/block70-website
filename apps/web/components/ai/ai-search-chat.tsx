"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { clsx } from "clsx";
import type { AISearchMode, AISearchResult, AISearchChatTurn } from "@/lib/ai-search-api";
import { postAISearch } from "@/lib/ai-search-api";
import {
  buildStructuredAnswer,
  enrichRelatedTokens,
  fetchInstantCoinCards,
  formatCoinDataRow,
  recommendationBadgeClass,
  streamTextChunks,
  type EnrichedCoinRow,
  type InstantCoinCard,
  type StructuredAnswer,
  FOLLOW_UP_SUGGESTIONS,
} from "@/lib/ai-search-enrich";
import { getExchangeBuyUrls } from "@/lib/exchange-buy-urls";
import { formatChangePct, formatCompactUsd } from "@/lib/format";

const SUGGESTED_PROMPTS = [
  "What crypto should I buy right now?",
  "Top DePIN projects with highest ROI",
  "Is Ethereum a good investment?",
  "Trending coins today",
  "Best crypto under $1",
] as const;

const MODES: { id: AISearchMode; label: string }[] = [
  { id: "general", label: "General" },
  { id: "signals", label: "Trading Signals" },
  { id: "investing", label: "Long-Term Investing" },
  { id: "depin", label: "DePIN Focus" },
  { id: "beginner", label: "Beginner Mode" },
];

const STORAGE_CHAT = "block70-ai-chat-v1";
const STORAGE_BOOKMARKS = "block70-ai-coin-bookmarks";
const STORAGE_SAVED = "block70-ai-saved-queries";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  result?: AISearchResult;
  structured?: StructuredAnswer;
  enriched?: EnrichedCoinRow[];
  instantCards?: InstantCoinCard[];
  streamText?: string;
  done?: boolean;
};

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function loadBookmarks(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_BOOKMARKS);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as string[];
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function saveBookmarks(next: Set<string>) {
  localStorage.setItem(STORAGE_BOOKMARKS, JSON.stringify([...next]));
}

export function AISearchChat() {
  const formId = useId();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<AISearchMode>("general");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setBookmarks(loadBookmarks());
  }, []);

  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_CHAT);
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[];
        if (Array.isArray(parsed) && parsed.length) setMessages(parsed);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_CHAT, JSON.stringify(messages.slice(-40)));
    } catch {
      /* ignore */
    }
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const toggleBookmark = useCallback((slug: string) => {
    setBookmarks((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      saveBookmarks(next);
      return next;
    });
  }, []);

  const saveQuery = useCallback((q: string, summary: string) => {
    try {
      const raw = localStorage.getItem(STORAGE_SAVED);
      const list = raw ? (JSON.parse(raw) as { q: string; summary: string; at: string }[]) : [];
      list.unshift({ q, summary: summary.slice(0, 200), at: new Date().toISOString() });
      localStorage.setItem(STORAGE_SAVED, JSON.stringify(list.slice(0, 50)));
    } catch {
      /* ignore */
    }
  }, []);

  async function runSend(userText: string) {
    const q = userText.trim();
    if (!q || loading) return;

    const userMsg: ChatMessage = { id: uid(), role: "user", content: q };
    const assistantId = uid();
    setError(null);
    setLoading(true);
    setMessages((m) => [...m, userMsg, { id: assistantId, role: "assistant", content: "", streamText: "", done: false }]);

    const history: AISearchChatTurn[] = [...messages, userMsg]
      .filter((m) => m.role === "user" || (m.role === "assistant" && m.content.trim()))
      .map((m) => ({
        role: m.role,
        content: m.content,
      }));

    let instant: InstantCoinCard[] = [];
    try {
      instant = await fetchInstantCoinCards(q, 6);
    } catch {
      /* ignore */
    }

    setMessages((m) =>
      m.map((row) =>
        row.id === assistantId ? { ...row, instantCards: instant } : row
      )
    );

    try {
      const data = await postAISearch({
        queryText: q,
        mode,
        conversation: history,
      });

      let enriched: EnrichedCoinRow[] = [];
      try {
        enriched = await enrichRelatedTokens(data.related_tokens ?? []);
      } catch {
        /* ignore */
      }

      const structured = buildStructuredAnswer(data, enriched);

      await streamTextChunks(data.answer || "", (soFar) => {
        setMessages((m) =>
          m.map((row) => (row.id === assistantId ? { ...row, streamText: soFar } : row))
        );
      });

      setMessages((m) =>
        m.map((row) =>
          row.id === assistantId
            ? {
                ...row,
                content: data.answer,
                result: data,
                structured,
                enriched,
                streamText: data.answer,
                done: true,
              }
            : row
        )
      );
      saveQuery(q, structured.summary);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Request failed";
      setError(msg === "Failed to fetch" ? "Unable to reach the server. Check your connection." : msg);
      setMessages((m) => m.filter((row) => row.id !== assistantId));
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    setInput("");
    void runSend(q);
  }

  function applyPrompt(text: string) {
    setInput(text);
  }

  function sendFollowUp(text: string) {
    setInput(text);
    void runSend(text);
  }

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-col">
      <div className="pointer-events-none fixed inset-x-0 top-14 z-0 h-48 bg-gradient-to-b from-indigo-950/50 via-violet-950/20 to-transparent md:top-16" />

      <div className="relative z-10 flex flex-1 flex-col gap-4 pb-4">
        <header className="space-y-2 text-center sm:text-left">
          <h1 className="bg-gradient-to-r from-slate-100 via-indigo-100 to-violet-200 bg-clip-text text-2xl font-semibold tracking-tight text-transparent">
            AI Crypto Search
          </h1>
          <p className="text-sm text-[var(--b70-text-muted)]">
            Chat with Block70 intelligence — live market context, scores, and curated links. Not financial advice.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {MODES.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setMode(m.id)}
                className={clsx(
                  "rounded-full border px-3 py-1 text-[11px] font-medium transition",
                  mode === m.id
                    ? "border-indigo-400/60 bg-indigo-500/20 text-indigo-100"
                    : "border-[var(--b70-border)] text-[var(--b70-text-muted)] hover:border-indigo-500/40 hover:text-[var(--b70-text)]"
                )}
              >
                {m.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setMessages([]);
                try {
                  sessionStorage.removeItem(STORAGE_CHAT);
                } catch {
                  /* ignore */
                }
              }}
              className="text-xs font-medium text-[var(--b70-text-muted)] hover:text-[var(--b70-text)]"
            >
              Clear chat
            </button>
            <Link
              href="/ai-search/history"
              className="ml-auto text-xs font-medium text-indigo-400 hover:text-indigo-300 hover:underline"
            >
              History
            </Link>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[var(--b70-border)] bg-[var(--b70-card)]/80 shadow-xl backdrop-blur-sm">
          <div className="flex-1 space-y-4 overflow-y-auto px-3 py-4 sm:px-5">
            {messages.length === 0 && (
              <div className="rounded-xl border border-dashed border-[var(--b70-border)] bg-[var(--b70-bg)]/40 p-6 text-center text-sm text-[var(--b70-text-muted)]">
                Ask anything about crypto markets, signals, or tokens. Your conversation stays in this session
                until you refresh (saved to session storage).
              </div>
            )}

            {messages.map((msg) =>
              msg.role === "user" ? (
                <UserBubble key={msg.id} text={msg.content} />
              ) : (
                <AssistantBubble
                  key={msg.id}
                  msg={msg}
                  busy={loading && !msg.done}
                  bookmarks={bookmarks}
                  onBookmark={toggleBookmark}
                  onFollowUp={sendFollowUp}
                />
              )
            )}

            {error ? (
              <div className="rounded-xl border border-rose-800/50 bg-rose-950/30 p-3 text-sm text-rose-100">
                {error}
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>

          <div className="sticky bottom-0 border-t border-[var(--b70-border)] bg-gradient-to-t from-[var(--b70-bg)] via-[var(--b70-bg)] to-transparent px-3 pb-4 pt-3 sm:px-5">
            <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-[var(--b70-text-muted)]">
              Suggested prompts
            </p>
            <div className="mb-3 flex flex-wrap gap-2">
              {SUGGESTED_PROMPTS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => applyPrompt(p)}
                  className="rounded-full border border-indigo-500/25 bg-indigo-950/40 px-3 py-1.5 text-left text-[11px] text-indigo-100/90 transition hover:border-indigo-400/50 hover:bg-indigo-900/40"
                >
                  {p}
                </button>
              ))}
            </div>
            <form id={formId} onSubmit={onSubmit} className="relative flex gap-2">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    onSubmit(e as unknown as React.FormEvent);
                  }
                }}
                placeholder="Ask Block70… (Shift+Enter for newline)"
                rows={2}
                disabled={loading}
                className="min-h-[52px] flex-1 resize-none rounded-xl border border-[var(--b70-border)] bg-[var(--b70-bg)] px-4 py-3 text-sm text-[var(--b70-text)] placeholder:text-[var(--b70-text-muted)] focus:border-indigo-500/50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="self-end rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 px-5 py-3 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 disabled:opacity-40"
              >
                Send
              </button>
            </form>
          </div>
        </div>

        <p className="text-center text-[11px] text-[var(--b70-text-muted)] sm:text-left">
          <Link href="/signals" className="text-indigo-400 hover:underline">
            Signals
          </Link>
          {" · "}
          <Link href="/copilot" className="text-indigo-400 hover:underline">
            Copilot
          </Link>
          {" · "}
          <Link href="/trending" className="text-indigo-400 hover:underline">
            Trending
          </Link>
        </p>
      </div>
    </div>
  );
}

function UserBubble({ text }: { text: string }) {
  return (
    <div className="flex justify-end opacity-100 transition-opacity duration-300">
      <div className="max-w-[min(100%,520px)] rounded-2xl rounded-br-md bg-gradient-to-br from-indigo-600 to-violet-700 px-4 py-3 text-sm text-white shadow-md">
        {text}
      </div>
    </div>
  );
}

function AssistantBubble({
  msg,
  busy,
  bookmarks,
  onBookmark,
  onFollowUp,
}: {
  msg: ChatMessage;
  busy: boolean;
  bookmarks: Set<string>;
  onBookmark: (slug: string) => void;
  onFollowUp: (text: string) => void;
}) {
  const result = msg.result;
  const structured = msg.structured;
  const enriched = msg.enriched ?? [];
  const streamText = msg.streamText ?? "";

  return (
    <div className="flex justify-start opacity-100 transition-opacity duration-300">
      <div className="max-w-[min(100%,640px)] space-y-3 rounded-2xl rounded-bl-md border border-[var(--b70-border)] bg-[var(--b70-bg)]/90 px-4 py-3 text-sm shadow-inner">
        {msg.instantCards && msg.instantCards.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-emerald-400/90">
              Instant matches
            </p>
            <div className="flex flex-wrap gap-2">
              {msg.instantCards.map((c) => (
                <Link
                  key={c.id + c.href}
                  href={c.href}
                  className="flex min-w-[140px] max-w-[200px] flex-col rounded-lg border border-emerald-500/30 bg-emerald-950/20 px-3 py-2 text-[11px] transition hover:border-emerald-400/50"
                >
                  <span className="font-semibold text-[var(--b70-text)]">{c.title}</span>
                  {c.score != null && (
                    <span className="text-amber-200/90">Score {Math.round(c.score)}</span>
                  )}
                  {c.price_change_24h != null && (
                    <span
                      className={
                        c.price_change_24h >= 0 ? "text-emerald-400" : "text-red-400"
                      }
                    >
                      {formatChangePct(c.price_change_24h)}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}

        {busy && !streamText ? (
          <div className="flex gap-1.5 py-2" aria-hidden>
            <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400/80 [animation-delay:-0.2s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400/80 [animation-delay:-0.1s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-indigo-400/80" />
          </div>
        ) : null}

        {!msg.done && (streamText || busy) ? (
          <p className="whitespace-pre-wrap text-[var(--b70-text)]">{streamText}</p>
        ) : null}

        {msg.done && structured && result ? (
          <StructuredSections
            structured={structured}
            result={result}
            enriched={enriched}
            bookmarks={bookmarks}
            onBookmark={onBookmark}
          />
        ) : null}

        {msg.done && result ? (
          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--b70-border)] pt-3">
            <span className="text-[11px] text-[var(--b70-text-muted)]">
              Confidence:{" "}
              <span className="font-medium text-[var(--b70-text)]">
                {confidenceLabel(result.confidence_score)}
              </span>
            </span>
            <Link href="/signals" className="text-[11px] text-indigo-400 hover:underline">
              Data: Signals feed
            </Link>
            <Link href="/trending" className="text-[11px] text-indigo-400 hover:underline">
              Trending
            </Link>
          </div>
        ) : null}

        {msg.done && (
          <div className="flex flex-wrap gap-2 pt-1">
            {FOLLOW_UP_SUGGESTIONS.slice(0, 4).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onFollowUp(s)}
                className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)] px-2.5 py-1 text-[11px] text-[var(--b70-text-muted)] hover:border-indigo-500/40 hover:text-indigo-200"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function confidenceLabel(score: number): string {
  if (score >= 0.7) return "High";
  if (score >= 0.4) return "Medium";
  return "Low";
}

function StructuredSections({
  structured,
  result,
  enriched,
  bookmarks,
  onBookmark,
}: {
  structured: StructuredAnswer;
  result: AISearchResult;
  enriched: EnrichedCoinRow[];
  bookmarks: Set<string>;
  onBookmark: (slug: string) => void;
}) {
  const primary = enriched[0];

  return (
    <div className="space-y-4">
      <section>
        <h3 className="text-[10px] font-bold uppercase tracking-wide text-indigo-300/90">Summary (TLDR)</h3>
        <p className="mt-1 text-[var(--b70-text)]">{structured.summary}</p>
      </section>

      <section>
        <h3 className="text-[10px] font-bold uppercase tracking-wide text-indigo-300/90">Key insights</h3>
        <ul className="mt-1 list-inside list-disc space-y-1 text-[var(--b70-text-muted)]">
          {(structured.insights.length ? structured.insights : ["See summary and on-chain context in Signals and Radar."]).map(
            (line, i) => (
              <li key={i}>{line}</li>
            )
          )}
        </ul>
      </section>

      <section>
        <h3 className="text-[10px] font-bold uppercase tracking-wide text-indigo-300/90">Block70 proprietary</h3>
        <p className="mt-1 rounded-lg border border-amber-500/25 bg-amber-950/20 px-3 py-2 text-amber-100">
          {structured.block70SignalLine}
          {primary && (
            <span className="mt-1 block text-[11px] text-[var(--b70-text-muted)]">
              Trend: {primary.trendLabel} · {formatCoinDataRow(primary)}
            </span>
          )}
        </p>
        {structured.whaleNote ? (
          <p className="mt-2 text-[11px] text-[var(--b70-text-muted)]">{structured.whaleNote}</p>
        ) : null}
      </section>

      {enriched.length > 0 ? (
        <section>
          <h3 className="text-[10px] font-bold uppercase tracking-wide text-indigo-300/90">Data</h3>
          <div className="mt-2 space-y-2">
            {enriched.map((r) => (
              <div
                key={r.slug}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)]/50 px-3 py-2 text-[11px]"
              >
                <Link href={`/coins/${encodeURIComponent(r.slug)}`} className="font-medium text-crypto-blue hover:underline">
                  {r.name} ({r.symbol})
                </Link>
                <span className="tabular-nums text-[var(--b70-text-muted)]">
                  {formatCompactUsd(r.priceUsd)} · {formatChangePct(r.change24hPct)} · MCap{" "}
                  {formatCompactUsd(r.marketCapUsd)}
                </span>
                <span className="text-amber-200">Score {r.block70Score}</span>
                <button
                  type="button"
                  onClick={() => onBookmark(r.slug)}
                  className={clsx(
                    "text-[10px]",
                    bookmarks.has(r.slug) ? "text-amber-400" : "text-[var(--b70-text-muted)] hover:text-amber-300"
                  )}
                  aria-label={bookmarks.has(r.slug) ? "Remove bookmark" : "Bookmark"}
                >
                  {bookmarks.has(r.slug) ? "★ Saved" : "☆ Save"}
                </button>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <section>
        <h3 className="text-[10px] font-bold uppercase tracking-wide text-indigo-300/90">Recommendation</h3>
        <p
          className={clsx(
            "mt-1 inline-flex rounded-full border px-3 py-1 text-xs font-semibold",
            recommendationBadgeClass(structured.recommendation)
          )}
        >
          {structured.recommendation}
        </p>
      </section>

      {primary ? (
        <section className="space-y-2">
          <h3 className="text-[10px] font-bold uppercase tracking-wide text-indigo-300/90">
            Trade &amp; convert
          </h3>
          <div className="flex flex-wrap gap-2">
            <a
              href={getExchangeBuyUrls(primary.symbol, primary.slug).coinbase}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500"
            >
              Buy {primary.symbol} on Coinbase
            </a>
            <a
              href={getExchangeBuyUrls(primary.symbol, primary.slug).binanceUs}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-amber-500/40 bg-amber-950/30 px-3 py-2 text-xs font-semibold text-amber-100 hover:bg-amber-900/40"
            >
              Trade on Binance.US
            </a>
          </div>
        </section>
      ) : null}

      <section>
        <h3 className="text-[10px] font-bold uppercase tracking-wide text-indigo-300/90">Related coins</h3>
        <div className="mt-1 flex flex-wrap gap-2">
          {enriched.map((r) => (
            <Link
              key={r.slug}
              href={`/coins/${encodeURIComponent(r.slug)}`}
              className="rounded-lg bg-indigo-500/15 px-2 py-1 text-xs text-indigo-200 hover:bg-indigo-500/25"
            >
              {r.name}
            </Link>
          ))}
          {(result.related_tokens ?? []).filter((t) => !enriched.some((e) => e.symbol === t)).slice(0, 8).map((t) => (
            <Link key={t} href={`/signals/${encodeURIComponent(t)}`} className="rounded-lg bg-[var(--b70-border)]/40 px-2 py-1 text-xs text-[var(--b70-text)] hover:underline">
              {t}
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h3 className="text-[10px] font-bold uppercase tracking-wide text-indigo-300/90">Sources</h3>
        <ul className="mt-1 space-y-1 text-[11px] text-indigo-300/90">
          {enriched.map((r) => (
            <li key={r.slug}>
              <Link href={`/coins/${encodeURIComponent(r.slug)}`} className="hover:underline">
                {r.name} coin page
              </Link>
            </li>
          ))}
          <li>
            <Link href="/signals" className="hover:underline">
              Block70 signals
            </Link>
          </li>
          <li>
            <Link href="/radar" className="hover:underline">
              Radar events
            </Link>
          </li>
        </ul>
      </section>
    </div>
  );
}
