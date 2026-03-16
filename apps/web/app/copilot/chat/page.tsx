"use client";

import { useState } from "react";
import Link from "next/link";
import { getToken } from "@/lib/auth";

export default function CopilotChatPage() {
  const [input, setInput] = useState("");
  const isAuth = typeof window !== "undefined" && !!getToken();

  if (!isAuth) {
    return (
      <div className="mx-auto max-w-2xl space-y-6 p-4">
        <h1 className="text-2xl font-semibold text-[var(--b70-text)]">Copilot Chat</h1>
        <p className="text-sm text-[var(--b70-text-muted)]">Ask the AI about your portfolio and the market. Log in to use chat.</p>
        <Link href="/login" className="inline-block rounded-lg bg-crypto-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90">Log in</Link>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-[var(--b70-text)]">Copilot Chat</h1>
        <Link href="/copilot" className="text-sm font-medium text-crypto-blue hover:underline">Dashboard</Link>
      </div>
      <p className="text-sm text-[var(--b70-text-muted)]">
        Ask questions about your portfolio and the market. Chat API can be wired here to stream responses.
      </p>
      <div className="flex flex-col gap-2 rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4">
        <div className="min-h-[200px] rounded-lg bg-[var(--b70-bg)] p-3 text-sm text-[var(--b70-text-muted)]">
          Messages will appear here when the chat backend is connected.
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!input.trim()) return;
            setInput("");
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your portfolio or the market…"
            className="flex-1 rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] px-3 py-2 text-sm text-[var(--b70-text)] placeholder:text-[var(--b70-text-muted)]"
          />
          <button
            type="submit"
            className="rounded-lg bg-crypto-blue px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
