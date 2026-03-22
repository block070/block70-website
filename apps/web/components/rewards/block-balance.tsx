"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getBlocksBalance } from "@/lib/rewards-api";
import { clearToken } from "@/lib/auth";

export function BlockBalance() {
  const [balance, setBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    getBlocksBalance()
      .then((d) => setBalance(d.balance))
      .catch((err) => {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("401") || msg.includes("Not authenticated") || msg.includes("API error")) {
          clearToken();
          router.refresh();
        }
        setBalance(null);
      })
      .finally(() => setLoading(false));
  }, [router]);

  if (loading || balance === null) {
    return (
      <Link
        href="/rewards/store"
        className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm text-slate-400 hover:text-slate-200"
      >
        <span className="font-mono">—</span>
        <span className="text-xs">Blocks</span>
      </Link>
    );
  }

  return (
    <Link
      href="/rewards/store"
      className="flex items-center gap-1.5 rounded-md border border-[var(--b70-border)] bg-slate-900/80 px-2.5 py-1 text-sm text-amber-300 hover:border-amber-500/50 hover:bg-slate-800/80"
      title="Blocks balance"
    >
      <span className="font-mono font-semibold">{Math.floor(balance)}</span>
      <span className="text-xs text-slate-400">Blocks</span>
    </Link>
  );
}
