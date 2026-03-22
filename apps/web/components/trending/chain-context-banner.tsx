"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

function slugToLabel(slug: string): string {
  return slug
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .replace(/Mainnet$/i, "Mainnet");
}

export function ChainContextBanner() {
  const searchParams = useSearchParams();
  const chain = searchParams.get("chain");
  if (!chain) return null;

  const label = slugToLabel(chain);

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 px-3 py-2 text-xs text-slate-300">
      <span>Showing trending from </span>
      <span className="font-medium text-slate-200">{label}</span>
      <span className="mx-1">·</span>
      <Link href="/trending" className="text-crypto-blue hover:underline">
        View all trending
      </Link>
    </div>
  );
}
