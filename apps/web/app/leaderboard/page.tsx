"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { getBlocksLeaderboard, type LeaderboardEntry } from "@/lib/rewards-api";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getBlocksLeaderboard(100)
      .then(setEntries)
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        <Link href="/dashboard">
          <Button variant="outline">← Back</Button>
        </Link>
        <h1 className="text-2xl font-bold text-slate-50">Blocks leaderboard</h1>
      </div>

      <p className="text-slate-400">
        Top users by Blocks balance. Earn Blocks from check-ins, referrals, alpha posts, and more.
      </p>

      <Card>
        <CardHeader
          title="Rank by Blocks"
          subtitle="Top 100"
        />
        <div className="overflow-x-auto">
          {loading ? (
            <div className="h-48 animate-pulse rounded bg-[var(--b70-border)] p-4" />
          ) : entries.length === 0 ? (
            <p className="p-4 text-slate-500">No data yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--b70-border)] text-left text-slate-500">
                  <th className="px-4 py-2 font-medium">Rank</th>
                  <th className="px-4 py-2 font-medium">User</th>
                  <th className="px-4 py-2 font-medium text-right">Blocks</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr
                    key={e.user_id}
                    className="border-b border-[var(--b70-border)] last:border-0"
                  >
                    <td className="px-4 py-2 font-medium text-slate-300">
                      #{e.rank}
                    </td>
                    <td className="px-4 py-2 text-slate-200">{e.name}</td>
                    <td className="px-4 py-2 text-right font-mono text-amber-300">
                      {Math.floor(e.balance)}
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
