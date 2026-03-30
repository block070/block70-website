"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  getRewardStore,
  redeemReward,
  getBlocksBalance,
  postCheckin,
  type RewardItemDto,
} from "@/lib/rewards-api";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function CheckinButton({ onSuccess }: { onSuccess: () => void }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const handleCheckin = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const r = await postCheckin();
      setMessage(r.message);
      onSuccess();
    } catch {
      setMessage("Already checked in today or error");
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="flex flex-col items-end gap-2">
      <Button onClick={handleCheckin} disabled={loading}>
        {loading ? "Claiming…" : "Claim daily Blocks"}
      </Button>
      {message && <p className="text-xs text-amber-300">{message}</p>}
    </div>
  );
}

export default function RewardsStorePage() {
  const [items, setItems] = useState<RewardItemDto[]>([]);
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [redeemingId, setRedeemingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    Promise.all([getRewardStore(), getBlocksBalance()])
      .then(([store, bal]) => {
        setItems(store);
        setBalance(bal.balance);
      })
      .catch(() => setError("Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleRedeem = async (item: RewardItemDto) => {
    setError(null);
    setRedeemingId(item.id);
    try {
      await redeemReward(item.id);
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Redeem failed");
    } finally {
      setRedeemingId(null);
    }
  };

  return (
    <div className="space-y-8">
      <p className="text-sm text-slate-400">
        <Link href="/store" className="text-crypto-blue hover:underline">
          Subscriptions &amp; plans
        </Link>
        <span className="text-slate-600"> · </span>
        Blocks catalog below
      </p>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-slate-50">Rewards store</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-400">
            Balance: <strong className="text-amber-300">{balance != null ? Math.floor(balance) : "—"} Blocks</strong>
          </span>
          <Link href="/dashboard">
            <Button variant="outline">Dashboard</Button>
          </Link>
        </div>
      </div>

      {error && (
        <p className="rounded bg-rose-500/20 px-3 py-2 text-sm text-rose-400">{error}</p>
      )}

      <p className="text-slate-400">
        Earn Blocks by checking in daily, sharing signals, posting alpha, and referring friends. Spend them here.
      </p>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <div className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div>
            <h2 className="font-semibold text-slate-200">Daily check-in</h2>
            <p className="text-sm text-slate-400">Claim Blocks once per day. Streak for 3, 7, or 30 days for bonus Blocks.</p>
          </div>
          <CheckinButton onSuccess={load} />
        </div>
      </Card>

      {loading ? (
        <div className="h-48 animate-pulse rounded bg-[var(--b70-border)]" />
      ) : items.length === 0 ? (
        <Card>
          <div className="p-6 text-center text-slate-500">
            No rewards in the store yet. Check back later.
          </div>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => (
            <Card key={item.id}>
              <CardHeader title={item.name} subtitle={item.reward_type} />
              <div className="space-y-4 p-4">
                {item.description && (
                  <p className="text-sm text-slate-400">{item.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <span className="font-mono text-lg font-semibold text-amber-300">
                    {item.block_cost} Blocks
                  </span>
                  <Button
                    disabled={
                      (balance != null && balance < item.block_cost) ||
                      redeemingId === item.id
                    }
                    onClick={() => handleRedeem(item)}
                  >
                    {redeemingId === item.id ? "Redeeming…" : "Redeem"}
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
