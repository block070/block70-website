"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type SearchCategory = "coins" | "wallets" | "airdrops" | "signals" | "narratives";

type SearchResult = {
  id: string;
  category: SearchCategory;
  title: string;
  subtitle?: string;
  href: string;
};

const CATEGORY_LABELS: Record<SearchCategory, string> = {
  coins: "Coins",
  wallets: "Wallets",
  airdrops: "Airdrops",
  signals: "Signals",
  narratives: "Narratives",
};

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const runSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q.trim())}&limit=8`,
      ).catch(() => null);
      if (res?.ok) {
        const data = await res.json();
        setResults(Array.isArray(data.results) ? data.results : []);
      } else {
        setResults(mockSearch(q.trim()));
      }
    } catch {
      setResults(mockSearch(q.trim()));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => runSearch(query), 200);
    return () => clearTimeout(t);
  }, [query, runSearch]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelect(href: string) {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(href);
  }

  return (
    <div ref={containerRef} className="relative w-full max-w-md">
      <div className="flex items-center rounded-lg border border-slate-700 bg-slate-900/80">
        <span className="pl-3 text-slate-500" aria-hidden>
          ⌘K
        </span>
        <input
          ref={inputRef}
          type="search"
          placeholder="Search coins, wallets, signals..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          className="w-full bg-transparent px-2 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none"
          aria-label="Global search"
          aria-expanded={open}
          aria-autocomplete="list"
          role="combobox"
        />
      </div>
      {open && (query.length > 0 || results.length > 0) && (
        <div
          className="absolute top-full left-0 right-0 z-50 mt-1 max-h-[320px] overflow-auto rounded-lg border border-slate-700 bg-slate-900 shadow-xl"
          role="listbox"
        >
          {loading ? (
            <div className="p-4 text-center text-xs text-slate-400">
              Searching...
            </div>
          ) : results.length === 0 ? (
            <div className="p-4 text-center text-xs text-slate-400">
              No results. Try &quot;BTC&quot;, &quot;SOL&quot;, or &quot;airdrop&quot;
            </div>
          ) : (
            <ul className="py-2">
              {results.map((r) => (
                <li key={`${r.category}-${r.id}`}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-800 focus:bg-slate-800 focus:outline-none"
                    onClick={() => handleSelect(r.href)}
                    role="option"
                  >
                    <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400">
                      {CATEGORY_LABELS[r.category]}
                    </span>
                    <span className="font-medium text-slate-100">{r.title}</span>
                    {r.subtitle ? (
                      <span className="truncate text-xs text-slate-500">
                        {r.subtitle}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

function mockSearch(q: string): SearchResult[] {
  const lower = q.toLowerCase();
  const out: SearchResult[] = [];
  const coins = ["BTC", "ETH", "SOL", "AVAX", "DOGE", "LINK"];
  const matches = coins.filter((c) => c.toLowerCase().includes(lower));
  matches.slice(0, 3).forEach((c) => {
    out.push({
      id: c,
      category: "coins",
      title: c,
      subtitle: "Coin",
      href: `/coins/${c.toLowerCase()}`,
    });
  });
  if (lower.includes("signal")) {
    out.push({
      id: "signals",
      category: "signals",
      title: "Signals feed",
      href: "/signals",
    });
  }
  if (lower.includes("airdrop")) {
    out.push({
      id: "airdrops",
      category: "airdrops",
      title: "Airdrops",
      href: "/airdrops",
    });
  }
  if (lower.includes("wallet") || lower.includes("whale")) {
    out.push({
      id: "wallets",
      category: "wallets",
      title: "Smart wallets",
      href: "/wallets",
    });
  }
  if (lower.includes("narrative")) {
    out.push({
      id: "narratives",
      category: "narratives",
      title: "Narratives",
      href: "/narratives",
    });
  }
  return out.slice(0, 8);
}
