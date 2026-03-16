"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getTrendingAlpha, type AlphaPostDto } from "@/lib/community-api";
import { PostCard } from "@/components/community/post-card";
import { Button } from "@/components/ui/button";

export default function CommunityTrendingPage() {
  const [posts, setPosts] = useState<AlphaPostDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTrendingAlpha(30)
      .then(setPosts)
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/community">
          <Button variant="outline">← Back</Button>
        </Link>
        <h1 className="text-2xl font-bold text-slate-50">Trending alpha</h1>
      </div>
      <p className="text-slate-400">
        Most popular posts by votes, engagement, author reputation, and recency.
      </p>
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-lg bg-[var(--b70-border)]"
            />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <p className="text-slate-500">No trending posts yet.</p>
      ) : (
        <div className="space-y-3">
          {posts.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}
    </div>
  );
}
