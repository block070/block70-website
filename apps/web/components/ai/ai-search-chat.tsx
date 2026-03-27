"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { clsx } from "clsx";
import { Activity, BookOpen, Coins, Layers, LineChart, Newspaper, Wallet } from "lucide-react";
import type { AISearchMode, AISearchResult, AISearchChatTurn, AISearchCapitalFlow, AISearchWalletClip } from "@/lib/ai-search-api";
import { getAISearchPopular, postAISearch } from "@/lib/ai-search-api";
import {
  bestActionBadgeClass,
  buildSourceSummary,
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
import { useExchangeAffiliateTemplates } from "@/contexts/exchange-affiliate-context";
import { getExchangeBuyUrls } from "@/lib/exchange-buy-urls";
import { formatChangePct, formatCompactUsd } from "@/lib/format";

const CURATED_PROMPTS = [
  "What is trending in crypto?",
  "What coins are whales buying?",
  "What narratives are growing?",
  "What crypto should I buy right now?",
  "Top trending coins today",
  "Best DePIN projects",
  "Is Bitcoin a good investment?",
  "Low cap coins with high potential",
] as const;

function mergeSuggested(
  curated: readonly string[],
  popular: { query_normalized: string }[],
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of curated) {
    const t = p.trim();
    const k = t.toLowerCase();
    if (!t || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  for (const row of popular) {
    const t = (row.query_normalized || "").trim();
    const k = t.toLowerCase();
    if (!t || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= 12) break;
  }
  return out.slice(0, 12);
}

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
  const [popularQueries, setPopularQueries] = useState<{ query_normalized: string; hit_count: number }[]>(
    [],
  );
  const bottomRef = useRef<HTMLDivElement>(null);

  const suggestedMerged = useMemo(
    () => mergeSuggested(CURATED_PROMPTS, popularQueries),
    [popularQueries],
  );

  useEffect(() => {
    let cancelled = false;
    void getAISearchPopular(24).then((rows) => {
      if (!cancelled) setPopularQueries(rows);
    });
    return () => {
      cancelled = true;
    };
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
      <header className="mx-auto w-full max-w-5xl space-y-2 text-center">
        <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--b70-crypto-blue)]">
          Intelligence
        </p>
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--b70-text)] md:text-3xl">
          Crypto intelligence assistant
        </h1>
        <p className="text-sm text-[var(--b70-text-muted)]">
          Narratives, market tape, signals, and whale context—synthesized from Block70. Not financial advice.
        </p>
      </header>

      <div className="mx-auto mt-6 flex w-full max-w-5xl flex-wrap justify-center gap-2">
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

      <section className="mx-auto mt-6 w-full max-w-5xl">
        <p className="mb-2 text-center text-[10px] font-semibold uppercase tracking-wider text-[var(--b70-text-muted)]">
          Suggested questions
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          {suggestedMerged.map((p) => (
            <button
              key={p}
              type="button"
              disabled={loading}
              onClick={() => applyPromptAndSend(p)}
              className="rounded-full border border-[var(--b70-border)] bg-[var(--b70-card)] px-3 py-2 text-left text-xs text-[var(--b70-text)] transition hover:border-[var(--b70-crypto-blue)]/45 hover:bg-[var(--b70-bg)] disabled:opacity-40"
            >
              {p}
            </button>
          ))}
        </div>
      </section>

      <form
        id={formId}
        onSubmit={onSubmit}
        className="mx-auto mt-8 w-full max-w-3xl px-1"
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

      <div className="mx-auto mt-10 w-full max-w-5xl flex-1 space-y-10 pb-8">
        {error ? (
          <div className="rounded-xl border border-rose-800/50 bg-rose-950/30 p-4 text-sm text-rose-100">
            {error}
          </div>
        ) : null}

        {messages.map((msg) =>
          msg.role === "user" ? (
            <div key={msg.id} className="flex justify-end">
              <div className="max-w-2xl rounded-2xl rounded-br-sm border border-[var(--b70-crypto-blue)]/35 bg-[var(--b70-crypto-blue)]/15 px-4 py-2.5 text-sm text-[var(--b70-text)]">
                {msg.content}
              </div>
            </div>
          ) : (
            <div
              key={msg.id}
              className="rounded-2xl border border-[var(--b70-border)]/80 bg-[var(--b70-card)]/40 p-4 md:p-6"
            >
              <AssistantResult msg={msg} onFollowUp={(t) => void runSend(t)} />
            </div>
          )
        )}
        <div ref={bottomRef} />
      </div>

      <p className="mx-auto mt-auto max-w-5xl pb-4 text-center text-[11px] text-[var(--b70-text-muted)]">
        <Link href="/ai-search/history" className="text-[var(--b70-crypto-blue)] hover:underline">
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
        <Link href="/signals" className="text-[var(--b70-crypto-blue)] hover:underline">
          Signals
        </Link>
      </p>
    </div>
  );
}

function SourcesStrip({ result }: { result: AISearchResult }) {
  const s = buildSourceSummary(result);
  return (
    <section className="rounded-2xl border border-[var(--b70-border)] bg-[var(--b70-bg)]/50 p-4">
      <h2 className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--b70-text-muted)]">
        <Newspaper className="h-3.5 w-3.5" aria-hidden />
        Sources
      </h2>
      <p className="text-[11px] text-[var(--b70-text-muted)]">
        Grounded in Block70 data. Open desks for full context; headline digests live on News.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link
          href={s.newsHref}
          className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)] px-3 py-1.5 text-xs font-medium text-[var(--b70-text)] hover:border-[var(--b70-crypto-blue)]/50"
        >
          News desk
        </Link>
        <Link
          href={s.marketHref}
          className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)] px-3 py-1.5 text-xs font-medium text-[var(--b70-text)] hover:border-[var(--b70-crypto-blue)]/50"
        >
          Market data
        </Link>
        <Link
          href={s.walletsHref}
          className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)] px-3 py-1.5 text-xs font-medium text-[var(--b70-text)] hover:border-[var(--b70-crypto-blue)]/50"
        >
          Whale and smart wallets
        </Link>
        {(s.hasRadar || s.flowCount > 0 || s.walletClipCount > 0 || s.signalCount > 0 || s.narrativeCount > 0) ? (
          <span className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-800 dark:text-amber-200">
            This answer: {s.signalCount} signals
            {s.narrativeCount ? ` · ${s.narrativeCount} narratives` : ""}
            {s.flowCount ? ` · ${s.flowCount} flows` : ""}
            {s.walletClipCount ? ` · ${s.walletClipCount} wallets` : ""}
            {s.hasRadar ? " · radar events" : ""}
          </span>
        ) : null}
      </div>
    </section>
  );
}

function NarrativesPanel({
  narratives,
}: {
  narratives: NonNullable<AISearchResult["related_narratives"]>;
}) {
  return (
    <section className="rounded-2xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--b70-text)]">
        <Layers className="h-4 w-4 text-[var(--b70-crypto-blue)]" aria-hidden />
        Narratives
      </h2>
      {narratives.length === 0 ? (
        <p className="text-xs text-[var(--b70-text-muted)]">
          No narrative rows in this snapshot. Try{" "}
          <Link href="/narratives" className="text-[var(--b70-crypto-blue)] hover:underline">
            Narratives
          </Link>{" "}
          for the full directory.
        </p>
      ) : (
        <ul className="space-y-3">
          {narratives.map((n, i) => (
            <li
              key={`${n.name}-${i}`}
              className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)]/60 p-3 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-semibold text-[var(--b70-text)]">{n.name}</span>
                <span className="font-[family-name:var(--font-jetbrains)] text-[var(--b70-crypto-orange)]">
                  {Number(n.trend_score).toFixed(0)}
                </span>
              </div>
              {n.description ? (
                <p className="mt-1 line-clamp-3 text-[var(--b70-text-muted)]">{n.description}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      <Link
        href="/narratives"
        className="mt-3 inline-block text-[11px] font-medium text-[var(--b70-crypto-blue)] hover:underline"
      >
        Open narratives hub
      </Link>
    </section>
  );
}

function SignalsPanel({
  signals,
}: {
  signals: NonNullable<AISearchResult["related_signals"]>;
}) {
  return (
    <section className="rounded-2xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--b70-text)]">
        <Activity className="h-4 w-4 text-emerald-500" aria-hidden />
        Signals
      </h2>
      {!signals?.length ? (
        <p className="text-xs text-[var(--b70-text-muted)]">
          No signal rows matched this query. Browse the{" "}
          <Link href="/signals" className="text-[var(--b70-crypto-blue)] hover:underline">
            live feed
          </Link>
          .
        </p>
      ) : (
        <ul className="space-y-2">
          {signals.slice(0, 12).map((s, idx) => (
            <li key={`${s.id}-${idx}`} className="rounded-lg border border-[var(--b70-border)] px-3 py-2 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium text-[var(--b70-text)]">{s.title ?? "Signal"}</span>
                <span className="text-[10px] uppercase text-[var(--b70-text-muted)]">{s.signal_type}</span>
              </div>
              <div className="mt-1">
                {s.token_symbol ? (
                  <Link
                    href={`/signals/${encodeURIComponent(s.token_symbol)}`}
                    className="text-[var(--b70-crypto-blue)] hover:underline"
                  >
                    {s.token_symbol}
                  </Link>
                ) : (
                  <Link href="/signals" className="text-[var(--b70-crypto-blue)] hover:underline">
                    All signals
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FlowWalletPanel({
  flows,
  wallets,
}: {
  flows: AISearchCapitalFlow[];
  wallets: AISearchWalletClip[];
}) {
  return (
    <section className="rounded-2xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--b70-text)]">
        <Wallet className="h-4 w-4 text-[var(--b70-crypto-blue)]" aria-hidden />
        Capital flow and whales
      </h2>
      <div className="grid gap-4 md:grid-cols-2">
        {flows.length > 0 ? (
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase text-[var(--b70-text-muted)]">Flows</p>
            <ul className="space-y-1.5 text-xs">
              {flows.map((f, i) => (
                <li key={`${f.source_asset}-${f.destination_asset}-${i}`} className="text-[var(--b70-text-muted)]">
                  <span className="font-medium text-[var(--b70-text)]">
                    {f.source_asset} to {f.destination_asset}
                  </span>
                  {" · "}
                  {formatCompactUsd(f.amount)} on {f.chain}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {wallets.length > 0 ? (
          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase text-[var(--b70-text-muted)]">
              Smart wallets (clip)
            </p>
            <ul className="space-y-1.5 text-xs">
              {wallets.map((w) => (
                <li key={w.wallet_address} className="text-[var(--b70-text-muted)]">
                  <span className="font-mono text-[var(--b70-text)]">
                    {w.wallet_address.slice(0, 10)}…
                  </span>
                  {" · "}win{" "}
                  {(w.win_rate <= 1 ? w.win_rate * 100 : w.win_rate).toFixed(0)}%
                  {w.total_profit_usd != null ? ` · PnL ${formatCompactUsd(w.total_profit_usd)}` : ""}
                </li>
              ))}
            </ul>
            <Link
              href="/wallets/top"
              className="mt-2 inline-block text-[11px] text-[var(--b70-crypto-blue)] hover:underline"
            >
              Full leaderboard
            </Link>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function AssistantResult({
  msg,
  onFollowUp,
}: {
  msg: Extract<ChatMessage, { role: "assistant" }>;
  onFollowUp: (text: string) => void;
}) {
  const affiliateTemplates = useExchangeAffiliateTemplates();
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

  const narratives = msg.result?.related_narratives ?? [];
  const flows = msg.result?.related_capital_flows ?? [];
  const wallets = msg.result?.related_wallet_activity ?? [];

  return (
    <div className="space-y-5">
      {msg.loading && !msg.instantCards?.length ? <ResultSkeleton /> : null}

      {opportunityCards && opportunityCards.length > 0 ? (
        <section className="rounded-2xl border border-emerald-500/25 bg-emerald-950/15 p-4">
          <h2 className="mb-1 flex items-center gap-2 text-sm font-semibold text-emerald-200/95">
            <Coins className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
            Coins and opportunities
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
            <LineChart className="h-4 w-4 shrink-0 text-[var(--b70-crypto-blue)]" aria-hidden />
            Smart answer
          </h2>
          <div className="mx-auto max-w-3xl text-sm leading-relaxed">
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

      {msg.done && msg.result ? <SourcesStrip result={msg.result} /> : null}

      {msg.done && msg.result ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <NarrativesPanel narratives={narratives} />
          <SignalsPanel signals={msg.result.related_signals ?? []} />
        </div>
      ) : null}

      {msg.done && (flows.length > 0 || wallets.length > 0) ? (
        <FlowWalletPanel flows={flows} wallets={wallets} />
      ) : null}

      {msg.done && msg.structured && msg.result ? (
        <>
          <section className="rounded-2xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--b70-text)]">
              <BookOpen className="h-4 w-4 shrink-0 text-[var(--b70-crypto-blue)]" aria-hidden />
              Key insights
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
            <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-indigo-100/90">
              <LineChart className="h-4 w-4 opacity-80" aria-hidden />
              Data snapshot
            </h2>
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
                href={getExchangeBuyUrls(primary.symbol, primary.slug, affiliateTemplates).coinbase}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-500"
              >
                Buy on Coinbase
              </a>
              <a
                href={getExchangeBuyUrls(primary.symbol, primary.slug, affiliateTemplates).binanceUs}
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
        <Coins className="h-5 w-5 text-[var(--b70-text-muted)] opacity-50" aria-hidden />
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
