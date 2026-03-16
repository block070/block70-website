"use client";

import { useState } from "react";
import { voteAlphaPost } from "@/lib/community-api";
import { ThumbsUp, ThumbsDown } from "lucide-react";

type VoteButtonsProps = {
  postId: number;
  initialScore: number;
  onVote?: (newScore: number) => void;
};

export function VoteButtons({
  postId,
  initialScore,
  onVote,
}: VoteButtonsProps) {
  const [score, setScore] = useState(initialScore);
  const [loading, setLoading] = useState(false);

  const handleVote = async (voteType: "up" | "down") => {
    setLoading(true);
    try {
      const res = await voteAlphaPost(postId, voteType);
      setScore(res.vote_score);
      onVote?.(res.vote_score);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => handleVote("up")}
        disabled={loading}
        className="rounded p-1.5 text-slate-400 hover:bg-[var(--b70-border)] hover:text-emerald-400 disabled:opacity-50"
        aria-label="Upvote"
      >
        <ThumbsUp className="h-4 w-4" />
      </button>
      <span className="min-w-[2rem] text-center text-sm font-medium text-slate-200">
        {score}
      </span>
      <button
        type="button"
        onClick={() => handleVote("down")}
        disabled={loading}
        className="rounded p-1.5 text-slate-400 hover:bg-[var(--b70-border)] hover:text-rose-400 disabled:opacity-50"
        aria-label="Downvote"
      >
        <ThumbsDown className="h-4 w-4" />
      </button>
    </div>
  );
}
