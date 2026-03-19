import Link from "next/link";
import type { SmartMoneyWallet } from "@/data/smartMoneyWallets";
import { BlurData } from "./blur-data";
import { ScoreBadge } from "./score-badge";

type WalletTableProps = {
  wallets: SmartMoneyWallet[];
  previewLocked?: boolean;
  previewCount?: number;
  showLockedRows?: boolean;
};

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function timeAgo(iso: string | null): string {
  if (!iso) return "Data unavailable";
  const parsed = new Date(iso).getTime();
  if (!Number.isFinite(parsed)) return "Data unavailable";
  const diff = Date.now() - parsed;
  const mins = Math.max(1, Math.floor(diff / 60000));
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function formatCoin(chain: SmartMoneyWallet["chain"], v: number | null): string {
  if (v == null || Number.isNaN(v)) return "Data unavailable";
  const decimals = chain === "bitcoin" ? 6 : chain === "solana" ? 4 : 4;
  return v.toFixed(decimals);
}

function formatNetflow(wallet: SmartMoneyWallet): string {
  if (wallet.inflow24h == null || wallet.outflow24h == null) return "Data unavailable";
  const net = wallet.inflow24h - wallet.outflow24h;
  const decimals = wallet.chain === "bitcoin" ? 6 : wallet.chain === "solana" ? 4 : 4;
  const sign = net >= 0 ? "+" : "";
  return `${sign}${net.toFixed(decimals)}`;
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
            <th className="px-3 py-2">Tx Count</th>
            <th className="px-3 py-2">Balance</th>
            <th className="px-3 py-2">Netflow (24H)</th>
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
              <td className="px-3 py-2 text-slate-300">{timeAgo(wallet.lastActivity)}</td>
              <td className="px-3 py-2 text-slate-300">
                <BlurData locked={previewLocked} tooltip="Unlock to view">
                  {wallet.txCount == null ? "Data unavailable" : wallet.txCount}
                </BlurData>
              </td>
              <td className="px-3 py-2 text-slate-300">
                <BlurData locked={previewLocked} tooltip="Unlock to view">
                  {formatCoin(wallet.chain, wallet.balance)}
                </BlurData>
              </td>
              <td className="px-3 py-2">
                <BlurData locked={previewLocked} tooltip="Unlock to view">
                  <span className={wallet.inflow24h && wallet.outflow24h && wallet.inflow24h - wallet.outflow24h >= 0 ? "text-emerald-300" : "text-rose-300"}>
                    {formatNetflow(wallet)}
                  </span>
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

