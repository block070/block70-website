"use client";

import { useState } from "react";

import type { Opportunity } from "@/lib/types";
import { API_BASE_URL } from "@/lib/api";

type Props = {
  opportunity: Opportunity;
};

export function ShareCardButton({ opportunity }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (!opportunity?.id) return;

    setLoading(true);
    setError(null);

    try {
      const url = `${API_BASE_URL}/api/v1/opportunities/${opportunity.id}/share-card`;

      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Share card request failed with status ${res.status}`);
      }

      const blob = await res.blob();
      const file = new File([blob], `block70-opportunity-${opportunity.slug}.png`, {
        type: "image/png",
      });

      // Prefer the Web Share API when available (mobile / modern browsers).
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: opportunity.title,
          text:
            opportunity.summary ??
            "Research-grade crypto opportunity from the Block70 Alpha Network.",
          files: [file],
        });
      } else {
        // Fallback: trigger a download.
        const objectUrl = URL.createObjectURL(file);
        const a = document.createElement("a");
        a.href = objectUrl;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(objectUrl);
      }
    } catch (e) {
      setError("Unable to generate a share card right now.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-1 rounded-full border border-emerald-500/60 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-emerald-300 hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Preparing…" : "Share Alpha"}
      </button>
      {error ? (
        <p className="text-[10px] text-rose-300">{error}</p>
      ) : null}
    </div>
  );
}

