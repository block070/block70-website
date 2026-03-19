"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { upgradeToPro } from "@/lib/auth";

type Props = {
  compact?: boolean;
};

export function UpgradeToProButton({ compact = false }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onUpgrade() {
    setError(null);
    setLoading(true);
    try {
      await upgradeToPro();
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upgrade failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={compact ? "space-y-1" : "space-y-2"}>
      <button
        type="button"
        onClick={onUpgrade}
        disabled={loading}
        className="rounded-lg border border-emerald-400/40 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-300 hover:bg-emerald-500/20 disabled:opacity-60"
      >
        {loading ? "Upgrading..." : "Upgrade to Pro"}
      </button>
      {error ? <p className="text-xs text-rose-300">{error}</p> : null}
    </div>
  );
}

