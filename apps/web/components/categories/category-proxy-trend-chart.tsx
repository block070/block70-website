"use client";

import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type OhlcvBar = { time: number; close: number };

export function CategoryProxyTrendChart({
  symbol,
  slug,
  label,
}: {
  symbol: string;
  slug: string;
  label: string;
}) {
  const [rows, setRows] = useState<{ date: string; close: number }[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const sym = encodeURIComponent(symbol);
    fetch(`/api/charts/${sym}?timeframe=7D&slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((j: { ohlcv?: OhlcvBar[]; error?: string | null }) => {
        if (cancelled) return;
        if (j.error) {
          setError(j.error);
          return;
        }
        const ohlcv = j.ohlcv ?? [];
        setRows(
          ohlcv.map((b) => ({
            date: new Date(b.time * 1000).toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            }),
            close: b.close,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setError("Chart unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [symbol, slug]);

  if (error) {
    return <p className="text-xs text-[var(--b70-text-muted)]">{error}</p>;
  }
  if (!rows.length) {
    return <p className="text-xs text-[var(--b70-text-muted)]">Loading chart…</p>;
  }

  return (
    <div className="w-full min-w-0 pt-1">
      <p className="mb-2 text-[10px] leading-snug text-[var(--b70-text-muted)]">
        Top constituent trend (proxy): {label} — not a full sector index.
      </p>
      <div className="h-[220px] min-h-[200px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
        <LineChart data={rows} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="opacity-20" />
          <XAxis dataKey="date" tick={{ fontSize: 10 }} />
          <YAxis tick={{ fontSize: 10 }} width={52} domain={["auto", "auto"]} />
          <Tooltip />
          <Line type="monotone" dataKey="close" stroke="#38bdf8" strokeWidth={2} dot={false} />
        </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
