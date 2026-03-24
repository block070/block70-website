"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { clsx } from "clsx";
import type { AISearchMode, AISearchResult, AISearchChatTurn } from "@/lib/ai-search-api";
import { postAISearch } from "@/lib/ai-search-api";
import {
  bestActionBadgeClass,
  buildStructuredAnswer,
  enrichRelatedTokens,
  enrichSearchHitsToRows,
  fetchInstantCoinCards,
  mergeUniqueBySlug,
  opportunityLabelBadgeClass,
  rowsToOpportunities,
  streamTextChunks,
  type EnrichedCoinRow,
  type OpportunityCard,
  type StructuredAnswer,
  FOLLOW_UP_SUGGESTIONS,
} from "@/lib/ai-search-enrich";
import { getExchangeBuyUrls } from "@/lib/exchange-buy-urls";
import { formatChangePct, formatCompactUsd } from "@/lib/format";

const SUGGESTED_PROMPTS = [
  "What crypto should I buy right now?",
  "Top trending coins today",
  "Best DePIN projects",
  "Is Bitcoin a good investment?",
  "Low cap coins with high potential",
] as const;

const MODES: { id: AISearchMode; label: string }[] = [
  { id: "general", label: "General" },
  { id: "signals", label: "Trading Signals" },
  { id: "investing", label: "Long-Term Investing" },
  { id: "beginner", label: "Beginner" },
];

const STORAGE_CHAT = "block70-ai-chat-v2";

type ChatMessage =
  | { id: string; role: "user"; content: string }
  | {
      id: string;
      role: "assistant";
      loading: boolean;
      instantCards?: OpportunityCard[];
      streamSummary?: string;
      structured?: StructuredAnswer;
      result?: AISearchResult;
      done: boolean;
    };

function uid() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function AISearchChat() {
  const formId = useId();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [mode, setMode] = useState<AISearchMode>("general");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

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
      sessionStorage.setItem(STORAGE_CHAT, JSON.stringify(messages.slice(-24)));
    } catch {
      /* ignore */
    }
  }, [messages]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function runSend(userText: string) {
    const q = userText.trim();
    if (!q || loading) return;

    const userMsg: ChatMessage = { id: uid(), role: "user", content: q };
    const assistantId = uid();
    setError(null);
    setLoading(true);
    setMessages((m) => [
      ...m,
      userMsg,
      {
        id: assistantId,
        role: "assistant",
        loading: true,
        done: false,
      },
    ]);

    const conversationTurns: AISearchChatTurn[] = [];
    for (const m of messages) {
      if (m.role === "user") {
        conversationTurns.push({ role: "user", content: m.content });
      } else if (m.role === "assistant" && m.done && m.structured) {
        conversationTurns.push({
          role: "assistant",
          content: m.structured.summary,
        });
      }
    }
    conversationTurns.push({ role: "user", content: q });

    void (async () => {
      try {
        const instantHits = await fetchInstantCoinCards(q, 3);
        const instantRows = await enrichSearchHitsToRows(instantHits);
        const instantCards = rowsToOpportunities(instantRows, 3);
        setMessages((m) =>
          m.map((row) =>
            row.id === assistantId && row.role === "assistant"
              ? { ...row, instantCards }
              : row
          )
        );

        const data = await postAISearch({
          queryText: q,
          mode,
          conversation: conversationTurns.filter((t) => t.content.trim()),
        });

        let enriched: EnrichedCoinRow[] = [];
        try {
          enriched = await enrichRelatedTokens(data.related_tokens ?? []);
        } catch {
          /* ignore */
        }

        const merged = mergeUniqueBySlug([...instantRows, ...enriched]);
        const structured = buildStructuredAnswer(data, merged);

        await streamTextChunks(structured.summary, (soFar) => {
          setMessages((m) =>
            m.map((row) =>
              row.id === assistantId && row.role === "assistant"
                ? { ...row, streamSummary: soFar }
                : row
            )
          );
        }, { msPerChunk: 8, chunkSize: 4 });

        setMessages((m) =>
          m.map((row) =>
            row.id === assistantId && row.role === "assistant"
              ? {
                  ...row,
                  loading: false,
                  done: true,
                  structured,
                  result: data,
                  streamSummary: structured.summary,
                }
              : row
          )
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Request failed";
        setError(msg === "Failed to fetch" ? "Unable to reach the server. Check your connection." : msg);
        setMessages((m) => m.filter((row) => row.id !== assistantId));
      } finally {
        setLoading(false);
      }
    })();
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    setInput("");
    void runSend(q);
  }

  function applyPromptAndSend(text: string) {
    setInput(text);
    void runSend(text);
  }

  return (
    <div className="flex min-h-[calc(100vh-7rem)] flex-col">
      <header className="mx-auto w-full max-w-3xl space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--b70-text)] md:text-3xl">
          AI Crypto Assistant
        </h1>
        <p className="text-sm text-[var(--b70-text-muted)]">
          Ask anything. Get signals, insights, and opportunities.
        </p>
      </header>

      <div className="mx-auto mt-6 flex w-full max-w-3xl flex-wrap justify-center gap-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => setMode(m.id)}
            className={clsx(
              "rounded-full border px-4 py-1.5 text-xs font-medium transition",
              mode === m.id
                ? "border-indigo-400/60 bg-indigo-500/20 text-indigo-100"
                : "border-[var(--b70-border)] text-[var(--b70-text-muted)] hover:border-indigo-500/35 hover:text-[var(--b70-text)]"
            )}
          >
            {m.label}
          </button>
        ))}
      </div>

      <section className="mx-auto mt-6 w-full max-w-3xl">
        <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--b70-text-muted)]">
          Suggested prompts
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {SUGGESTED_PROMPTS.map((p) => (
            <button
              key={p}
              type="button"
              disabled={loading}
              onClick={() => applyPromptAndSend(p)}
              className="rounded-full border border-indigo-500/25 bg-indigo-950/35 px-3 py-2 text-left text-xs text-indigo-100/95 transition hover:border-indigo-400/45 hover:bg-indigo-900/35 disabled:opacity-40"
            >
              {p}
            </button>
          ))}
        </div>
      </section>

      <form
        id={formId}
        onSubmit={onSubmit}
        className="mx-auto mt-8 w-full max-w-2xl px-1"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <label className="sr-only" htmlFor="ai-assistant-input">
            Ask about crypto
          </label>
          <input
            id="ai-assistant-input"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about crypto, trends, or investment opportunities..."
            disabled={loading}
            className="min-h-[56px] flex-1 rounded-2xl border border-[var(--b70-border)] bg-[var(--b70-card)] px-5 py-4 text-center text-base text-[var(--b70-text)] shadow-inner placeholder:text-[var(--b70-text-muted)] focus:border-indigo-500/45 focus:outline-none focus:ring-2 focus:ring-indigo-500/25 sm:text-left"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="h-[56px] shrink-0 rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-700 px-8 text-sm font-semibold text-white shadow-lg transition hover:brightness-110 disabled:opacity-40"
          >
            Submit
          </button>
        </div>
      </form>

      <div className="mx-auto mt-10 w-full max-w-3xl flex-1 space-y-8 pb-8">
        {error ? (
          <div className="rounded-xl border border-rose-800/50 bg-rose-950/30 p-4 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {messages.map((msg) =>
          msg.role === "user" ? (
            <div key={msg.id} className="flex justify-end">
              <div className="max-w-lg rounded-2xl rounded-br-sm bg-indigo-600/90 px-4 py-2.5 text-sm text-white">
                {msg.content}
              </div>
            </div>
          ) : (
            <AssistantResult
              key={msg.id}
              msg={msg}
              onFollowUp={(t) => void runSend(t)}
            />
          )
        )}
        <div ref={bottomRef} />
      </div>

      <p className="mx-auto mt-auto max-w-3xl pb-4 text-center text-[11px] text-[var(--b70-text-muted)]">
        <Link href="/ai-search/history" className="text-indigo-400 hover:underline">
          History
        </Link>
        {" · "}
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
          className="text-[var(--b70-text-muted)] hover:text-[var(--b70-text)]"
        >
          Clear
        </button>
        {" · "}
        <Link href="/signals" className="text-indigo-400 hover:underline">
          Signals
        </Link>
      </p>
    </div>
  );
}

function AssistantResult({
  msg,
  onFollowUp,
}: {
  msg: Extract<ChatMessage, { role: "assistant" }>;
  onFollowUp: (text: string) => void;
}) {
  const primary = msg.structured?.opportunities[0];
  const opportunityCards: OpportunityCard[] | undefined =
    msg.done && msg.structured?.opportunities.length
      ? msg.structured.opportunities
      : msg.instantCards;

  const tldrBody =
    msg.structured &&
    msg.structured.summary
      .split(/(?<=[.!?])\s+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(1, 3)
      .join(" ");

  return (
    <div className="space-y-5">
      {msg.loading && !msg.instantCards?.length ? <ResultSkeleton /> : null}

      {opportunityCards && opportunityCards.length > 0 ? (
        <section className="rounded-2xl border border-emerald-500/25 bg-emerald-950/15 p-4">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-emerald-200/95">
            <span aria-hidden>🚀</span> Top opportunities
          </h2>
          <p className="mb-3 text-[11px] text-emerald-200/70">
            {msg.done
              ? "Ranked using Block70 scores and live market fields."
              : "Instant matches from search — full analysis loads next."}
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {opportunityCards.map((c) => (
              <OpportunityCardView key={c.slug} card={c} />
            ))}
          </div>
        </section>
      ) : null}

      {msg.loading && msg.instantCards?.length ? (
        <div className="rounded-2xl border border-[var(--b70-border)] bg-[var(--b70-card)]/50 p-4">
          <div className="h-4 w-1/3 animate-pulse rounded bg-slate-600/50" />
          <div className="mt-3 h-3 w-full animate-pulse rounded bg-slate-700/40" />
          <div className="mt-2 h-3 w-5/6 animate-pulse rounded bg-slate-700/40" />
        </div>
      ) : null}

      {(msg.streamSummary || (msg.done && msg.structured)) && (
        <section className="rounded-2xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-5">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--b70-text)]">
            <span aria-hidden>📊</span> Summary (TLDR)
          </h2>
          <div className="mx-auto max-w-xl text-sm leading-relaxed">
            {msg.done && msg.structured ? (
              <>
                <p className="font-semibold text-[var(--b70-text)]">{msg.structured.boldTakeaway}</p>
                {tldrBody ? (
                  <p className="mt-2 text-[var(--b70-text-muted)]">{tldrBody}</p>
                ) : null}
              </>
            ) : (
              <p className="whitespace-pre-wrap text-[var(--b70-text-muted)]">{msg.streamSummary}</p>
            )}
          </div>
        </section>
      )}

      {msg.done && msg.structured && msg.result ? (
        <>
          <section className="rounded-2xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--b70-text)]">
              <span aria-hidden>💡</span> Key insights
            </h2>
            <ul className="mx-auto max-w-xl list-inside list-disc space-y-2 text-sm text-[var(--b70-text-muted)]">
              {(msg.structured.insights.length
                ? msg.structured.insights
                : ["Cross-check with your risk tolerance and position sizing."]
              ).map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-indigo-500/20 bg-indigo-950/20 p-5">
            <h2 className="mb-3 text-sm font-semibold text-indigo-100/90">Data snapshot</h2>
            <div className="mx-auto grid max-w-xl gap-3 text-sm sm:grid-cols-3">
              <SnapshotItem label="Market trend" value={msg.structured.dataSnapshot.marketTrend} />
              <SnapshotItem label="Volume trend" value={msg.structured.dataSnapshot.volumeTrend} />
              <SnapshotItem label="Top sector" value={msg.structured.dataSnapshot.topSector} />
            </div>
          </section>

          <section className="rounded-2xl border border-amber-500/25 bg-amber-950/15 p-5">
            <h2 className="mb-2 text-sm font-semibold text-amber-100">Recommendation</h2>
            <p className="text-sm text-[var(--b70-text-muted)]">Best action right now:</p>
            <p
              className={clsx(
                "mt-2 inline-flex rounded-full border px-4 py-2 text-sm font-bold",
                bestActionBadgeClass(msg.structured.bestAction)
              )}
            >
              {msg.structured.bestAction}
            </p>
            <p className="mt-3 text-xs text-[var(--b70-text-muted)]">
              Confidence:{" "}
              <span className="font-medium text-[var(--b70-text)]">
                {msg.result.confidence_score >= 0.7
                  ? "High"
                  : msg.result.confidence_score >= 0.4
                    ? "Medium"
                    : "Low"}
              </span>
            </p>
          </section>

          {primary ? (
            <section className="flex flex-wrap gap-3 rounded-2xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-5">
              <a
                href={getExchangeBuyUrls(primary.symbol, primary.slug).coinbase}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
              >
                Buy on Coinbase
              </a>
              <a
                href={getExchangeBuyUrls(primary.symbol, primary.slug).binanceUs}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl border border-amber-500/40 bg-amber-950/35 px-4 py-2.5 text-sm font-semibold text-amber-100 hover:bg-amber-900/40"
              >
                Trade on Binance.US
              </a>
            </section>
          ) : null}

          <details className="rounded-2xl border border-[var(--b70-border)] bg-[var(--b70-bg)]/50 p-4 text-sm">
            <summary className="cursor-pointer font-medium text-[var(--b70-text)] hover:text-indigo-300">
              Why this recommendation?
            </summary>
            <div className="mt-4 space-y-4 text-[var(--b70-text-muted)]">
              <div>
                <p className="text-xs font-semibold uppercase text-[var(--b70-text)]">Data sources</p>
                <ul className="mt-1 list-inside list-disc">
                  {msg.structured.whyReasons.sources.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-[var(--b70-text)]">Indicators considered</p>
                <ul className="mt-1 list-inside list-disc">
                  {msg.structured.whyReasons.indicators.map((s) => (
                    <li key={s}>{s}</li>
                  ))}
                </ul>
              </div>
            </div>
          </details>

          <div className="flex flex-wrap gap-2">
            {FOLLOW_UP_SUGGESTIONS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => onFollowUp(s)}
                className="rounded-full border border-[var(--b70-border)] bg-[var(--b70-card)] px-3 py-1.5 text-xs text-[var(--b70-text-muted)] hover:border-indigo-500/40 hover:text-indigo-200"
              >
                {s}
              </button>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

function SnapshotItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)]/60 px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-[var(--b70-text-muted)]">{label}</p>
      <p className="mt-1 text-lg font-bold tabular-nums text-indigo-100">{value}</p>
    </div>
  );
}

function OpportunityCardView({ card }: { card: OpportunityCard }) {
  return (
    <div className="flex flex-col rounded-xl border border-[var(--b70-border)] bg-[var(--b70-bg)]/80 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold text-[var(--b70-text)]">{card.name}</span>
        <span
          className={clsx(
            "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase",
            opportunityLabelBadgeClass(card.label)
          )}
        >
          {card.label}
        </span>
      </div>
      <div className="mt-3 space-y-1 text-xs tabular-nums text-[var(--b70-text-muted)]">
        <p>
          Price:{" "}
          <span className="font-medium text-[var(--b70-text)]">{formatCompactUsd(card.priceUsd)}</span>
        </p>
        <p>
          24h:{" "}
          <span className={card.change24hPct >= 0 ? "text-emerald-400" : "text-red-400"}>
            {formatChangePct(card.change24hPct)}
          </span>
        </p>
        <p>
          Block70:{" "}
          <span className="font-semibold text-amber-200">{card.block70Score}</span>
        </p>
      </div>
      <Link
        href={`/coins/${encodeURIComponent(card.slug)}`}
        className="mt-3 inline-flex w-fit rounded-lg bg-indigo-600/90 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-500"
      >
        View analysis
      </Link>
    </div>
  );
}

function ResultSkeleton() {
  return (
    <div className="space-y-4 rounded-2xl border border-[var(--b70-border)] bg-[var(--b70-card)]/40 p-5">
      <div className="flex items-center gap-2">
        <span className="text-lg">🚀</span>
        <div className="h-5 w-40 animate-pulse rounded bg-slate-600/50" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-36 animate-pulse rounded-xl bg-slate-700/35" />
        ))}
      </div>
    </div>
  );
}
