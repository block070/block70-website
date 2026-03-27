"use client";

import Link from "next/link";
import { getToken } from "@/lib/auth";
import { LayoutTemplate, MessageSquare, Sparkles } from "lucide-react";

export default function CopilotChatPage() {
  const isAuth = typeof window !== "undefined" && !!getToken();

  if (!isAuth) {
    return (
      <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
        <h1 className="text-2xl font-semibold text-[var(--b70-text)]">Assistant chat</h1>
        <p className="text-sm text-[var(--b70-text-muted)]">
          Ask questions in natural language after logging in. The intelligence assistant answers with
          narratives, coins, sources, and flow context.
        </p>
        <Link
          href="/login"
          className="inline-block rounded-lg bg-crypto-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Log in
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-4 py-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 text-xs font-medium text-crypto-blue">
            <MessageSquare className="h-3.5 w-3.5" aria-hidden />
            AI assistant
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-[var(--b70-text)]">Chat</h1>
        </div>
        <Link
          href="/copilot"
          className="shrink-0 rounded-lg border border-[var(--b70-border)] px-3 py-2 text-xs font-medium text-[var(--b70-text)] hover:bg-[var(--b70-border)]"
        >
          Desk
        </Link>
      </div>

      <div className="rounded-2xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-6 shadow-b70-card">
        <div className="flex items-center gap-2 text-sm font-medium text-[var(--b70-text)]">
          <Sparkles className="h-4 w-4 text-crypto-blue" aria-hidden />
          Use the intelligence assistant
        </div>
        <p className="mt-2 text-sm leading-relaxed text-[var(--b70-text-muted)]">
          Natural-language Q&amp;A runs on <span className="text-[var(--b70-text)]">AI Search</span>—one
          stream for narratives, tickers, signals, and citation-style sources. Open it to start a
          session; you can ask about your book, themes, or cross-market context.
        </p>
        <Link
          href="/ai-search"
          className="mt-5 inline-flex items-center justify-center rounded-lg bg-crypto-blue px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
        >
          Open AI Search
        </Link>
        <p className="mt-4 text-xs text-[var(--b70-text-muted)]">
          Dedicated streaming Copilot chat can be added here later; today the product path is shared
          intelligence to avoid duplicating context pipelines.
        </p>
      </div>

      <p className="text-center text-xs text-[var(--b70-text-muted)]">
        <Link href="/ai-search" className="font-medium text-crypto-blue hover:underline">
          /ai-search
        </Link>
        {" · "}
        <Link href="/copilot" className="inline-flex items-center gap-1 font-medium text-crypto-blue hover:underline">
          <LayoutTemplate className="h-3 w-3" aria-hidden />
          Desk
        </Link>
      </p>
    </div>
  );
}
