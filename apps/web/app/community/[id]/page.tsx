"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getAlphaPost, type AlphaPostDto } from "@/lib/community-api";
import { VoteButtons } from "@/components/community/vote-buttons";
import { CommentSection } from "@/components/community/comment-section";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function CommunityPostPage() {
  const params = useParams();
  const id = Number(params.id);
  const [post, setPost] = useState<AlphaPostDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Number.isNaN(id)) {
      setError("Invalid post");
      setLoading(false);
      return;
    }
    getAlphaPost(id)
      .then(setPost)
      .catch(() => setError("Post not found"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 animate-pulse rounded bg-[var(--b70-border)]" />
        <div className="h-64 animate-pulse rounded bg-[var(--b70-border)]" />
      </div>
    );
  }

  if (error || !post) {
    return (
      <div className="space-y-6">
        <p className="text-rose-400">{error ?? "Not found"}</p>
        <Link href="/community">
          <Button>Back to community</Button>
        </Link>
      </div>
    );
  }

  const voteScore = post.vote_score ?? 0;

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/community">
          <Button variant="outline">← Back</Button>
        </Link>
      </div>

      <Card className="p-6">
        <div className="flex justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-bold text-slate-50">{post.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              {post.token_symbol && (
                <Link
                  href={`/alpha/${post.token_symbol}`}
                  className="font-medium text-[var(--b70-crypto-blue)] hover:underline"
                >
                  {post.token_symbol}
                </Link>
              )}
              <Link
                href={`/community/users/${post.user_id}`}
                className="hover:text-slate-300"
              >
                {post.author_name ?? "Anonymous"}
              </Link>
              <span>{(post.confidence_score * 100).toFixed(0)}% confidence</span>
              <span>{post.alpha_type}</span>
              <span>{new Date(post.created_at).toLocaleString()}</span>
            </div>
          </div>
          <VoteButtons postId={post.id} initialScore={voteScore} />
        </div>
        <div className="mt-4 prose prose-invert max-w-none text-slate-300 whitespace-pre-wrap">
          {post.content}
        </div>
      </Card>

      <CommentSection postId={post.id} />
    </div>
  );
}
