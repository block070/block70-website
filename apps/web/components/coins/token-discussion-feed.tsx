"use client";

import { useEffect, useState } from "react";
import { getToken } from "@/lib/auth";
import { API_BASE_URL } from "@/lib/api";
import Link from "next/link";

type CommentDto = {
  id: number;
  user_id: number;
  token_symbol: string;
  content: string;
  upvotes: number;
  created_at: string | null;
};

type Props = {
  tokenSymbol: string;
  commentsUrl: string;
};

export function TokenDiscussionFeed({ tokenSymbol, commentsUrl }: Props) {
  const [comments, setComments] = useState<CommentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [newContent, setNewContent] = useState("");
  const [posting, setPosting] = useState(false);
  const isAuth = typeof window !== "undefined" && !!getToken();

  useEffect(() => {
    fetch(commentsUrl, { cache: "no-store" })
      .then((r) => r.ok ? r.json() : [])
      .then((data) => setComments(Array.isArray(data) ? data : []))
      .catch(() => setComments([]))
      .finally(() => setLoading(false));
  }, [commentsUrl]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newContent.trim() || !isAuth) return;
    setPosting(true);
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/tokens/${encodeURIComponent(tokenSymbol)}/comments`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({ content: newContent.trim().slice(0, 5000) }),
        },
      );
      if (res.ok) {
        const comment = await res.json();
        setComments((prev) => [comment, ...prev]);
        setNewContent("");
      }
    } finally {
      setPosting(false);
    }
  }

  async function handleUpvote(commentId: number) {
    if (!isAuth) return;
    try {
      const res = await fetch(
        `${API_BASE_URL}/api/v1/tokens/comments/${commentId}/upvote`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${getToken()}` },
        },
      );
      if (res.ok) {
        const data = await res.json();
        setComments((prev) =>
          prev.map((c) => (c.id === commentId ? { ...c, upvotes: data.upvotes } : c)),
        );
      }
    } catch {
      // ignore
    }
  }

  if (loading) {
    return <p className="text-sm text-[var(--b70-text-muted)]">Loading comments…</p>;
  }

  return (
    <div className="space-y-4">
      {isAuth ? (
        <form onSubmit={handleSubmit} className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4">
          <textarea
            value={newContent}
            onChange={(e) => setNewContent(e.target.value)}
            placeholder="Add a comment…"
            className="w-full rounded-lg border border-[var(--b70-border)] bg-[var(--b70-bg)] px-3 py-2 text-sm text-[var(--b70-text)] placeholder:text-[var(--b70-text-muted)]"
            rows={3}
            maxLength={5000}
          />
          <button
            type="submit"
            disabled={posting || !newContent.trim()}
            className="mt-2 rounded-lg bg-crypto-blue px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {posting ? "Posting…" : "Post comment"}
          </button>
        </form>
      ) : (
        <p className="text-xs text-[var(--b70-text-muted)]">
          <Link href="/login" className="text-crypto-blue hover:underline">Log in</Link> to post a comment.
        </p>
      )}

      {comments.length === 0 ? (
        <p className="text-sm text-[var(--b70-text-muted)]">No comments yet.</p>
      ) : (
        <ul className="space-y-3">
          {comments.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-[var(--b70-border)] bg-[var(--b70-card)] p-4"
            >
              <p className="text-sm text-[var(--b70-text)]">{c.content}</p>
              <div className="mt-2 flex items-center gap-3 text-xs text-[var(--b70-text-muted)]">
                <span>{c.created_at ? new Date(c.created_at).toLocaleString() : ""}</span>
                <button
                  type="button"
                  onClick={() => handleUpvote(c.id)}
                  className="font-medium text-crypto-blue hover:underline"
                >
                  ↑ {c.upvotes}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
