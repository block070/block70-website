/**
 * Client-side whale watchlist (copy-trade follow list). Sync to server can be added later.
 * Stores normalized addresses per chain.
 */

export const WHALE_WATCHLIST_KEY = "b70-whale-watchlist-v1";
export const WHALE_ALERT_PRESETS_KEY = "b70-whale-alert-presets-v1";

export type WhaleWatchEntry = {
  chain: "bitcoin" | "ethereum" | "solana";
  address: string;
  label?: string;
  note?: string;
  addedAt: string;
};

export type WhaleAlertPreset = {
  id: string;
  label: string;
  /** USD threshold for transfer alerts; 0 = disabled */
  minTransferUsd: number;
  enabled: boolean;
};

const DEFAULT_ALERT_PRESETS: WhaleAlertPreset[] = [
  { id: "large-move", label: "Large moves (≥ $100k est.)", minTransferUsd: 100_000, enabled: false },
  { id: "new-token", label: "New token in flow", minTransferUsd: 0, enabled: false },
];

function readJson<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function getWhaleWatchlist(): WhaleWatchEntry[] {
  if (typeof window === "undefined") return [];
  return readJson<WhaleWatchEntry[]>(localStorage.getItem(WHALE_WATCHLIST_KEY), []);
}

export function setWhaleWatchlist(entries: WhaleWatchEntry[]): void {
  localStorage.setItem(WHALE_WATCHLIST_KEY, JSON.stringify(entries));
}

export function addWhaleWatchEntry(entry: Omit<WhaleWatchEntry, "addedAt"> & { addedAt?: string }): void {
  const list = getWhaleWatchlist();
  const key = `${entry.chain}:${entry.address.toLowerCase()}`;
  if (list.some((e) => `${e.chain}:${e.address.toLowerCase()}` === key)) return;
  list.push({
    ...entry,
    addedAt: entry.addedAt ?? new Date().toISOString(),
  });
  setWhaleWatchlist(list);
}

export function removeWhaleWatchEntry(chain: string, address: string): void {
  const addr = address.toLowerCase();
  setWhaleWatchlist(
    getWhaleWatchlist().filter((e) => !(e.chain === chain && e.address.toLowerCase() === addr)),
  );
}

export function isWhaleWatched(chain: string, address: string): boolean {
  const addr = address.toLowerCase();
  return getWhaleWatchlist().some((e) => e.chain === chain && e.address.toLowerCase() === addr);
}

export function getWhaleAlertPresets(): WhaleAlertPreset[] {
  if (typeof window === "undefined") return DEFAULT_ALERT_PRESETS;
  const cur = readJson<WhaleAlertPreset[]>(
    localStorage.getItem(WHALE_ALERT_PRESETS_KEY),
    DEFAULT_ALERT_PRESETS,
  );
  if (!cur.length) return DEFAULT_ALERT_PRESETS;
  return cur;
}

export function setWhaleAlertPresets(presets: WhaleAlertPreset[]): void {
  localStorage.setItem(WHALE_ALERT_PRESETS_KEY, JSON.stringify(presets));
}
