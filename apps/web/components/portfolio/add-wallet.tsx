"use client";

import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { addPortfolioWallet, syncPortfolio } from "@/lib/portfolio-api";

const CHAINS = [
  { value: "ethereum", label: "Ethereum" },
  { value: "solana", label: "Solana" },
  { value: "base", label: "Base" },
  { value: "arbitrum", label: "Arbitrum" },
] as const;

export function AddWallet() {
  const [walletAddress, setWalletAddress] = useState("");
  const [chain, setChain] = useState("solana");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "error"; text: string } | null>(null);

  const handleAdd = async () => {
    const address = walletAddress.trim();
    if (!address) {
      setMessage({ type: "error", text: "Enter a wallet address." });
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      await addPortfolioWallet(address, chain);
      setMessage({ type: "ok", text: "Wallet added. Syncing balances…" });
      setWalletAddress("");
      await syncPortfolio();
      setMessage({ type: "ok", text: "Sync complete." });
    } catch (e) {
      setMessage({
        type: "error",
        text: e instanceof Error ? e.message : "Failed to add wallet.",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader
        title="Track a wallet"
        subtitle="Add a wallet address to track balances and transactions"
      />
      <div className="space-y-3 p-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            Wallet address
          </label>
          <input
            type="text"
            value={walletAddress}
            onChange={(e) => setWalletAddress(e.target.value)}
            placeholder="0x... or base58"
            className="w-full rounded border border-[var(--b70-border)] bg-[var(--b70-input)] px-3 py-2 text-sm text-slate-200 placeholder:text-slate-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-400">
            Chain
          </label>
          <select
            value={chain}
            onChange={(e) => setChain(e.target.value)}
            className="w-full rounded border border-[var(--b70-border)] bg-[var(--b70-input)] px-3 py-2 text-sm text-slate-200"
          >
            {CHAINS.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <Button
          onClick={handleAdd}
          disabled={loading}
          className="w-full"
        >
          {loading ? "Adding…" : "Add wallet"}
        </Button>
        {message ? (
          <p
            className={`text-sm ${
              message.type === "ok" ? "text-emerald-400" : "text-rose-400"
            }`}
          >
            {message.text}
          </p>
        ) : null}
      </div>
    </Card>
  );
}
