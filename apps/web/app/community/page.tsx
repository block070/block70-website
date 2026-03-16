"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAlphaPosts, type AlphaPostDto } from "@/lib/community-api";
import { CreatePost } from "@/components/community/create-post";
import { PostCard } from "@/components/community/post-card";
import { Button } from "@/components/ui/button";
import { TrendingUp, Trophy } from "lucide-react";

export default function CommunityPage() {
  const [posts, setPosts] = useState<AlphaPostDto[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    try {
      const data = await getAlphaPosts({ limit: 50 });
      setPosts(data);
    } catch {
      setPosts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-50">Community alpha</h1>
        <div className="flex gap-2">
          <Link href="/community/trending">
            <Button variant="outline">
              <TrendingUp className="mr-1 h-4 w-4" />
              Trending
            </Button>
          </Link>
          <Link href="/community/leaderboard">
            <Button variant="outline">
              <Trophy className="mr-1 h-4 w-4" />
              Leaderboard
            </Button>
          </Link>
        </div>
      </div>

      <CreatePost onSuccess={load} />

      <section>
        <h2 className="text-lg font-semibold text-slate-100 mb-4">Feed</h2>
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-32 animate-pulse rounded-lg bg-[var(--b70-border)]"
              />
            ))}
          </div>
        ) : posts.length === 0 ? (
          <p className="text-slate-500">No posts yet. Create one above.</p>
        ) : (
          <div className="space-y-3">
            {posts.map((post) => (
              <PostCard key={post.id} post={post} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
