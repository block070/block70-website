"use client";

import { useState } from "react";
import type { NewsArticleSummary } from "@/lib/api";

const TIMEZONES = [
  { value: "UTC", label: "UTC" },
  { value: "America/Chicago", label: "Central" },
  { value: "America/New_York", label: "Standard" },
  { value: "America/Los_Angeles", label: "Pacific" },
] as const;

function formatDate(isoDate: string | null | undefined, tz: string): string {
  if (!isoDate) return "—";
  try {
    return new Date(isoDate).toLocaleString("en-US", {
      timeZone: tz,
      dateStyle: "short",
      timeStyle: "short",
    });
  } catch {
    return new Date(isoDate).toLocaleString();
  }
}

function stripHtml(input: string): string {
  const noTags = input.replace(/<[^>]*>/g, " ");
  return noTags
    .replace(/\s+/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

type Props = {
  articles: NewsArticleSummary[];
};

export function NewsFeed({ articles }: Props) {
  const [tz, setTz] = useState<string>("UTC");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label htmlFor="news-timezone" className="text-xs text-slate-400">
          Timezone
        </label>
        <select
          id="news-timezone"
          value={tz}
          onChange={(e) => setTz(e.target.value)}
          className="rounded-lg border border-[var(--b70-border)] bg-[var(--b70-card)] px-3 py-1.5 text-sm text-[var(--b70-text)] focus:border-crypto-blue/50 focus:outline-none focus:ring-1 focus:ring-crypto-blue/50"
        >
          {TIMEZONES.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-3">
        {articles.map((item, idx) => (
          <article
            key={item.id ?? item.url ?? idx}
            className="rounded-xl border border-slate-800 bg-slate-900/60 p-4 text-xs"
          >
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-50">
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline"
                >
                  {item.title}
                </a>
              </h2>
              <span className="text-[11px] text-slate-500">
                {formatDate(item.published_at, tz)}
              </span>
            </div>
            <p className="mt-1 text-[11px] text-slate-400">
              {item.source} · Live article
            </p>
            {item.summary && (
              <p className="mt-2 text-slate-300 line-clamp-4">
                {stripHtml(item.summary)}
              </p>
            )}
            <div className="mt-3">
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-medium text-blue-400 hover:text-blue-300"
              >
                Open source →
              </a>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
