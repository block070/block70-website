"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getAlphaLeaderboard } from "@/lib/community-api";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type LeaderboardEntry = {
  user_id: number;
  name: string;
  reputation_score: number;
  alpha_accuracy: number;
  followers: number;
};

export default function CommunityLeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAlphaLeaderboard(50)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/community">
          <Button variant="outline">← Back</Button>
        </Link>
        <h1 className="text-2xl font-bold text-slate-50">Alpha leaderboard</h1>
      </div>
      <p className="text-slate-400">
        Ranked by reputation, accuracy, and engagement.
      </p>
      <Card>
        <CardHeader title="Top users" subtitle="Reputation · Accuracy · Followers" />
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-4">
              <div className="h-48 animate-pulse rounded bg-[var(--b70-border)]" />
            </div>
          ) : entries.length === 0 ? (
            <p className="p-4 text-slate-500">No users yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--b70-border)] text-left text-slate-500">
                  <th className="px-4 py-2 font-medium">#</th>
                  <th className="px-4 py-2 font-medium">User</th>
                  <th className="px-4 py-2 font-medium text-right">Reputation</th>
                  <th className="px-4 py-2 font-medium text-right">Accuracy</th>
                  <th className="px-4 py-2 font-medium text-right">Followers</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e, i) => (
                  <tr
                    key={e.user_id}
                    className="border-b border-[var(--b70-border)] last:border-0"
                  >
                    <td className="px-4 py-2 font-medium text-slate-400">
                      {i + 1}
                    </td>
                    <td className="px-4 py-2">
                      <Link
                        href={`/community/users/${e.user_id}`}
                        className="font-medium text-[var(--b70-crypto-blue)] hover:underline"
                      >
                        {e.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-right text-slate-300">
                      {e.reputation_score.toFixed(1)}
                    </td>
                    <td className="px-4 py-2 text-right text-emerald-400">
                      {(e.alpha_accuracy * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-2 text-right text-slate-400">
                      {e.followers}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
