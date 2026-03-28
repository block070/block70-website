"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { clsx } from "clsx";
import type { AlphaPostDto } from "@/lib/community-api";
import {
  confidencePercent,
  parseAlphaPostSections,
  presentCommunityAlphaCategory,
} from "@/lib/alpha-desk-present";

type Props = {
  post: AlphaPostDto;
  /** Free users see blurred body for high-confidence posts. */
  premiumLocked: boolean;
};

export function AlphaPostDeskCard({ post, premiumLocked }: Props) {
  const category = presentCommunityAlphaCategory(post.alpha_type);
  const conf = confidencePercent(post.confidence_score);
  const parsed = parseAlphaPostSections(post.content);

  return (
    <article
      className={clsx(
        "flex flex-col rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4 shadow-sm",
        "transition-colors hover:border-[var(--b70-crypto-blue)]/35",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-[var(--b70-crypto-blue)]/35 bg-[var(--b70-crypto-blue)]/10 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--b70-crypto-blue)]">
          {category.label}
        </span>
        <span className="text-[10px] text-[var(--b70-text-muted)]">
          Confidence {conf}%
        </span>
        {post.token_symbol ? (
          <span className="rounded-md border border-[var(--b70-border)] bg-[var(--b70-bg)] px-2 py-0.5 font-[family-name:var(--font-jetbrains)] text-xs text-[var(--b70-text)]">
            {post.token_symbol}
          </span>
        ) : null}
      </div>
      <h3 className="mt-2 font-[family-name:var(--font-jetbrains)] text-sm font-semibold text-[var(--b70-text)]">
        {post.title}
      </h3>
      {premiumLocked ? (
        <div className="relative mt-3 overflow-hidden rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] p-3">
          <p className="text-[11px] text-[var(--b70-text-muted)]">
            Institutional desk note — unlock full thesis on Pro/Elite.
          </p>
          <div className="pointer-events-none max-h-28 select-none blur-sm">
            <p className="text-xs text-[var(--b70-text)]">{parsed.summary}</p>
          </div>
          <div className="pointer-events-none absolute inset-0 flex items-end justify-center bg-gradient-to-t from-[var(--b70-card)] via-[var(--b70-card)]/80 to-transparent pb-2">
            <Link
              href="/pricing"
              className="pointer-events-auto rounded-lg bg-[var(--b70-crypto-blue)] px-3 py-1.5 text-[11px] font-semibold text-white"
            >
              View plans
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-3 space-y-2 text-xs">
          {parsed.summary ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--b70-text-muted)]">
                Summary
              </p>
              <p className="mt-0.5 leading-relaxed text-[var(--b70-text-muted)]">
                {parsed.summary}
              </p>
            </div>
          ) : null}
          {parsed.keyInsight ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--b70-crypto-blue)]">
                Key insight
              </p>
              <p className="mt-0.5 leading-relaxed text-[var(--b70-text)]">{parsed.keyInsight}</p>
            </div>
          ) : null}
          {parsed.whyItMatters ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--b70-text-muted)]">
                Why it matters
              </p>
              <p className="mt-0.5 leading-relaxed text-[var(--b70-text-muted)]">
                {parsed.whyItMatters}
              </p>
            </div>
          ) : null}
          {parsed.potentialImpact ? (
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--b70-text-muted)]">
                Potential impact
              </p>
              <p className="mt-0.5 leading-relaxed text-[var(--b70-text-muted)]">
                {parsed.potentialImpact}
              </p>
            </div>
          ) : null}
          {parsed.unstructuredNote ? (
            <p className="text-[10px] italic text-[var(--b70-text-muted)]">{parsed.unstructuredNote}</p>
          ) : null}
          {!parsed.usedMarkers ? (
            <p className="text-[10px] text-[var(--b70-text-muted)]">
              Tip: start lines with <span className="font-mono">Key insight:</span>,{" "}
              <span className="font-mono">Why it matters:</span>, or{" "}
              <span className="font-mono">Potential impact:</span> to structure posts.
            </p>
          ) : null}
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[var(--b70-border)] pt-3">
        <Link
          href={`/community/${post.id}`}
          className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--b70-crypto-blue)]/15 px-3 py-1.5 text-[11px] font-semibold text-[var(--b70-crypto-blue)] hover:bg-[var(--b70-crypto-blue)]/25"
        >
          <MessageCircle className="h-3.5 w-3.5" aria-hidden />
          Discuss
        </Link>
        <span className="text-[10px] text-[var(--b70-text-muted)]">
          {post.author_name ?? "Community"} · {post.comment_count ?? 0} comments
        </span>
      </div>
    </article>
  );
}
