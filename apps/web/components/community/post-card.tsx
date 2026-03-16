"use client";

import Link from "next/link";
import type { AlphaPostDto } from "@/lib/community-api";
import { VoteButtons } from "./vote-buttons";
import { Card } from "@/components/ui/card";

type PostCardProps = {
  post: AlphaPostDto;
};

export function PostCard({ post }: PostCardProps) {
  const voteScore = post.vote_score ?? 0;
  return (
    <Card className="p-4">
      <div className="flex justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Link
            href={`/community/${post.id}`}
            className="font-medium text-slate-100 hover:text-[var(--b70-crypto-blue)] hover:underline"
          >
            {post.title}
          </Link>
          <p className="mt-1 line-clamp-2 text-sm text-slate-400">
            {post.content}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-500">
            {post.token_symbol && (
              <Link
                href={`/alpha/${post.token_symbol}`}
                className="font-medium text-[var(--b70-crypto-blue)] hover:underline"
              >
                {post.token_symbol}
              </Link>
            )}
            <span>{post.author_name ?? "Anonymous"}</span>
            <span>{(post.confidence_score * 100).toFixed(0)}% confidence</span>
            <span>{new Date(post.created_at).toLocaleString()}</span>
            {post.comment_count != null && (
              <span>{post.comment_count} comments</span>
            )}
          </div>
        </div>
        <VoteButtons
          postId={post.id}
          initialScore={voteScore}
        />
      </div>
    </Card>
  );
}
