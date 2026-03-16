"use client";

import { useState } from "react";
import type { SentimentSummaryDto } from "@/lib/sentiment-api";
import { SentimentChart } from "./sentiment-chart";
import { SentimentVote } from "./sentiment-vote";

type Props = {
  tokenSymbol: string;
  initialSummary: SentimentSummaryDto | null;
  className?: string;
};

export function SentimentPanel({
  tokenSymbol,
  initialSummary,
  className = "",
}: Props) {
  const [summary, setSummary] = useState<SentimentSummaryDto | null>(initialSummary);

  return (
    <section
      className={`space-y-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs ${className}`}
    >
      <p className="text-[11px] uppercase tracking-wide text-slate-400">
        Community sentiment
      </p>
      <SentimentChart summary={summary} />
      <SentimentVote
        tokenSymbol={tokenSymbol}
        initialSummary={summary}
        onVoted={setSummary}
      />
    </section>
  );
}
