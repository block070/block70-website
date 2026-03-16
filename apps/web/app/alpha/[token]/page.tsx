"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { getAlphaPosts, type AlphaPostDto } from "@/lib/community-api";
import { PostCard } from "@/components/community/post-card";
import { Button } from "@/components/ui/button";

export default function AlphaTokenPage() {
  const params = useParams();
  const token = String(params.token ?? "").toUpperCase();
  const [posts, setPosts] = useState<AlphaPostDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    getAlphaPosts({ token_symbol: token, limit: 50 })
      .then(setPosts)
      .catch(() => setPosts([]))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/community">
          <Button variant="outline">← Community</Button>
        </Link>
        <h1 className="text-2xl font-bold text-slate-50">Alpha · {token}</h1>
      </div>
      <p className="text-slate-400">
        Community posts about {token}.
      </p>
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-28 animate-pulse rounded-lg bg-[var(--b70-border)]"
            />
          ))}
        </div>
      ) : posts.length === 0 ? (
        <p className="text-slate-500">No alpha posts for {token} yet.</p>
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
