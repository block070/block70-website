"use client";

import { useEffect, useState } from "react";
import {
  getAlphaPostComments,
  createAlphaComment,
  type AlphaCommentDto,
} from "@/lib/community-api";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type CommentSectionProps = {
  postId: number;
};

export function CommentSection({ postId }: CommentSectionProps) {
  const [comments, setComments] = useState<AlphaCommentDto[]>([]);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getAlphaPostComments(postId);
      setComments(data);
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [postId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      const newComment = await createAlphaComment(postId, content.trim());
      setComments((prev) => [...prev, newComment]);
      setContent("");
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Comments" subtitle={`${comments.length} comment(s)`} />
      <div className="p-4 space-y-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 rounded border border-[var(--b70-border)] bg-[var(--b70-input)] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
          />
          <Button type="submit" disabled={submitting || !content.trim()}>
            {submitting ? "…" : "Comment"}
          </Button>
        </form>
        {loading ? (
          <p className="text-sm text-slate-500">Loading comments…</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-slate-500">No comments yet.</p>
        ) : (
          <ul className="space-y-3">
            {comments.map((c) => (
              <li
                key={c.id}
                className="rounded border border-[var(--b70-border)] px-3 py-2 text-sm"
              >
                <p className="text-slate-300">{c.content}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {c.author_name ?? "User"} ·{" "}
                  {new Date(c.created_at).toLocaleString()}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
