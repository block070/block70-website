"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  getUserAlphaProfile,
  getUserAlphaPosts,
  type AlphaPostDto,
} from "@/lib/community-api";
import { PostCard } from "@/components/community/post-card";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Profile = {
  user_id: number;
  name: string;
  reputation_score: number;
  alpha_accuracy: number;
  followers: number;
  post_count: number;
};

export default function CommunityUserPage() {
  const params = useParams();
  const id = Number(params.id);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<AlphaPostDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (Number.isNaN(id)) {
      setError("Invalid user");
      setLoading(false);
      return;
    }
    Promise.all([getUserAlphaProfile(id), getUserAlphaPosts(id)])
      .then(([p, list]) => {
        setProfile(p);
        setPosts(list);
      })
      .catch(() => setError("User not found"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-24 animate-pulse rounded bg-[var(--b70-border)]" />
        <div className="h-48 animate-pulse rounded bg-[var(--b70-border)]" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="space-y-6">
        <p className="text-rose-400">{error ?? "Not found"}</p>
        <Link href="/community">
          <Button>Back to community</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/community">
          <Button variant="outline">← Back</Button>
        </Link>
      </div>

      <Card>
        <CardHeader title={profile.name} subtitle="Author profile" />
        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div>
            <p className="text-xs text-slate-500">Reputation</p>
            <p className="text-xl font-semibold text-slate-100">
              {profile.reputation_score.toFixed(1)}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Alpha accuracy</p>
            <p className="text-xl font-semibold text-slate-100">
              {(profile.alpha_accuracy * 100).toFixed(1)}%
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Followers</p>
            <p className="text-xl font-semibold text-slate-100">
              {profile.followers}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Posts</p>
            <p className="text-xl font-semibold text-slate-100">
              {profile.post_count}
            </p>
          </div>
        </div>
      </Card>

      <section>
        <h2 className="text-lg font-semibold text-slate-100 mb-4">Posts</h2>
        {posts.length === 0 ? (
          <p className="text-slate-500">No posts yet.</p>
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
