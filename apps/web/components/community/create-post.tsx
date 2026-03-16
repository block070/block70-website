"use client";

import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createAlphaPost } from "@/lib/community-api";

const ALPHA_TYPES = [
  { value: "trade_idea", label: "Trade idea" },
  { value: "signal", label: "Signal" },
  { value: "strategy", label: "Strategy" },
  { value: "research", label: "Research" },
] as const;

type CreatePostProps = {
  onSuccess?: () => void;
};

export function CreatePost({ onSuccess }: CreatePostProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [alphaType, setAlphaType] = useState<"trade_idea" | "signal" | "strategy" | "research">("trade_idea");
  const [confidence, setConfidence] = useState(0.7);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await createAlphaPost({
        title: title.trim() || "Untitled",
        content: content.trim() || "No content",
        token_symbol: tokenSymbol.trim() || null,
        alpha_type: alphaType,
        confidence_score: confidence,
      });
      setTitle("");
      setContent("");
      setTokenSymbol("");
      setConfidence(0.7);
      onSuccess?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create post");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader title="Create alpha post" subtitle="Share trade ideas, signals, or research" />
      <form onSubmit={handleSubmit} className="p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded border border-[var(--b70-border)] bg-[var(--b70-input)] px-3 py-2 text-sm text-slate-200"
            placeholder="Short title"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Token</label>
          <input
            type="text"
            value={tokenSymbol}
            onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
            className="w-full rounded border border-[var(--b70-border)] bg-[var(--b70-input)] px-3 py-2 text-sm text-slate-200"
            placeholder="e.g. SOL"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Content</label>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            className="w-full rounded border border-[var(--b70-border)] bg-[var(--b70-input)] px-3 py-2 text-sm text-slate-200"
            placeholder="Your alpha..."
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">Type</label>
          <select
            value={alphaType}
            onChange={(e) => setAlphaType(e.target.value as typeof alphaType)}
            className="w-full rounded border border-[var(--b70-border)] bg-[var(--b70-input)] px-3 py-2 text-sm text-slate-200"
          >
            {ALPHA_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-400 mb-1">
            Confidence score (0–1): {(confidence * 100).toFixed(0)}%
          </label>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={confidence}
            onChange={(e) => setConfidence(parseFloat(e.target.value))}
            className="w-full"
          />
        </div>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <Button type="submit" disabled={loading}>
          {loading ? "Posting…" : "Post"}
        </Button>
      </form>
    </Card>
  );
}
