import Link from "next/link";
import type { SmartMoneyWallet } from "@/data/smartMoneyWallets";
import { BlurData } from "./blur-data";
import { ScoreBadge } from "./score-badge";
import { TokenChip } from "./token-chip";

type WalletTableProps = {
  wallets: SmartMoneyWallet[];
  previewLocked?: boolean;
  previewCount?: number;
  showLockedRows?: boolean;
};

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.max(1, Math.floor(diff / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatPct(n: number): string {
  return `${n >= 0 ? "+" : ""}${(n * 100).toFixed(1)}%`;
}

function formatUsd(n: number): string {
  if (n >= 1e9) return `$${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  return `$${(n / 1e3).toFixed(1)}K`;
}

export function WalletTable({
  wallets,
  previewLocked = false,
  previewCount = 5,
  showLockedRows = false,
}: WalletTableProps) {
  const visibleRows = previewLocked ? wallets.slice(0, previewCount) : wallets;
  const lockedRows = previewLocked && showLockedRows ? new Array(3).fill(null) : [];

  return (
    <div className="overflow-hidden rounded-xl border border-slate-800">
      <table className="w-full text-left text-xs">
        <thead className="bg-slate-900/80 text-slate-400">
          <tr>
            <th className="px-3 py-2">Address</th>
            <th className="px-3 py-2">Score</th>
            <th className="px-3 py-2">Last Activity</th>
            <th className="px-3 py-2">ROI (30D)</th>
            <th className="px-3 py-2">Holdings</th>
            <th className="px-3 py-2">Top Tokens</th>
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((wallet) => (
            <tr key={wallet.id} className="border-t border-slate-800 bg-slate-950/50">
              <td className="px-3 py-2 text-slate-200">
                <Link href={`/wallets/${wallet.chain}/${wallet.address}`} className="hover:text-emerald-300">
                  {shortAddress(wallet.address)}
                </Link>
              </td>
              <td className="px-3 py-2">
                <ScoreBadge score={wallet.score} />
              </td>
              <td className="px-3 py-2 text-slate-300">{timeAgo(wallet.lastActivityIso)}</td>
              <td className="px-3 py-2 text-emerald-300">
                <BlurData locked={previewLocked} tooltip="Unlock to view">
                  {formatPct(wallet.roi30d)}
                </BlurData>
              </td>
              <td className="px-3 py-2 text-slate-300">
                <BlurData locked={previewLocked} tooltip="Unlock to view">
                  {formatUsd(wallet.holdingsUsd)}
                </BlurData>
              </td>
              <td className="px-3 py-2">
                <BlurData locked={previewLocked} tooltip="Unlock to view">
                  <div className="flex gap-1">
                    {wallet.topTokens.slice(0, 2).map((symbol) => (
                      <TokenChip key={symbol} symbol={symbol} />
                    ))}
                  </div>
                </BlurData>
              </td>
            </tr>
          ))}
          {lockedRows.map((_, idx) => (
            <tr key={`locked-${idx}`} className="border-t border-slate-800 bg-slate-950/30">
              <td className="px-3 py-2 text-slate-500">0x••••••••••••••••••••</td>
              <td className="px-3 py-2 text-slate-500">••</td>
              <td className="px-3 py-2 text-slate-500">••••</td>
              <td className="px-3 py-2 text-slate-500" title="Unlock to view">Locked</td>
              <td className="px-3 py-2 text-slate-500" title="Unlock to view">Locked</td>
              <td className="px-3 py-2 text-slate-500" title="Unlock to view">Locked</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

