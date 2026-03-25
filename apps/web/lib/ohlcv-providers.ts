/**
 * OHLCV from public APIs: Binance (primary) → Coinbase → CoinGecko.
 * Times are Unix seconds (lightweight-charts UTCTimestamp).
 */

export type OHLCVBar = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type ChartTimeframeKey = "1M" | "5M" | "1H" | "4H" | "1D" | "7D";

const TF_MAP: Record<
  ChartTimeframeKey,
  { binanceInterval: string; binanceLimit: number; coinbaseGranularity: number | null; geckoDays: string }
> = {
  "1M": { binanceInterval: "1m", binanceLimit: 300, coinbaseGranularity: 60, geckoDays: "1" },
  "5M": { binanceInterval: "5m", binanceLimit: 300, coinbaseGranularity: 300, geckoDays: "1" },
  "1H": { binanceInterval: "1h", binanceLimit: 168, coinbaseGranularity: 3600, geckoDays: "1" },
  "4H": { binanceInterval: "4h", binanceLimit: 200, coinbaseGranularity: 21600, geckoDays: "7" },
  "1D": { binanceInterval: "1d", binanceLimit: 200, coinbaseGranularity: 86400, geckoDays: "30" },
  "7D": { binanceInterval: "1d", binanceLimit: 14, coinbaseGranularity: 86400, geckoDays: "7" },
};

const TF_ALIGN_SEC: Record<ChartTimeframeKey, number> = {
  "1M": 60,
  "5M": 300,
  "1H": 3600,
  "4H": 14400,
  "1D": 86400,
  "7D": 86400,
};

/** Snap bar times to interval opens (UTC) so axes show :00 for hourly, etc. */
export function alignOhlcvBars(bars: OHLCVBar[], timeframe: ChartTimeframeKey): OHLCVBar[] {
  const sec = TF_ALIGN_SEC[timeframe];
  if (!bars.length || !sec) return bars;
  const sorted = [...bars].sort((a, b) => a.time - b.time);
  const buckets = new Map<
    number,
    { time: number; open: number; high: number; low: number; close: number; volume: number }
  >();
  const order: number[] = [];
  for (const b of sorted) {
    const at = Math.floor(b.time / sec) * sec;
    const ex = buckets.get(at);
    if (!ex) {
      buckets.set(at, {
        time: at,
        open: b.open,
        high: b.high,
        low: b.low,
        close: b.close,
        volume: b.volume,
      });
      order.push(at);
    } else {
      ex.high = Math.max(ex.high, b.high);
      ex.low = Math.min(ex.low, b.low);
      ex.close = b.close;
      ex.volume += b.volume;
    }
  }
  return order.sort((a, b) => a - b).map((t) => buckets.get(t)!);
}

function toBinancePair(symbol: string): string {
  const s = symbol.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  if (s.endsWith("USDT")) return s;
  return `${s}USDT`;
}

function toCoinbaseProduct(symbol: string): string {
  const base = symbol.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return `${base}-USD`;
}

/** Binance kline: [openTime, open, high, low, close, volume, ...] */
function parseBinanceKlines(raw: unknown): OHLCVBar[] {
  if (!Array.isArray(raw)) return [];
  const out: OHLCVBar[] = [];
  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 6) continue;
    const t = Number(row[0]);
    const open = Number(row[1]);
    const high = Number(row[2]);
    const low = Number(row[3]);
    const close = Number(row[4]);
    const vol = Number(row[5]);
    if (!Number.isFinite(t) || !Number.isFinite(close)) continue;
    out.push({
      time: Math.floor(t / 1000),
      open,
      high,
      low,
      close,
      volume: Number.isFinite(vol) ? vol : 0,
    });
  }
  return out.sort((a, b) => a.time - b.time);
}

export async function fetchBinanceOHLCV(
  symbol: string,
  timeframe: ChartTimeframeKey
): Promise<OHLCVBar[]> {
  const tf = TF_MAP[timeframe];
  const pair = toBinancePair(symbol);
  const url = `https://api.binance.com/api/v3/klines?symbol=${encodeURIComponent(pair)}&interval=${tf.binanceInterval}&limit=${tf.binanceLimit}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Binance ${res.status}`);
  const data = (await res.json()) as unknown;
  if (!Array.isArray(data)) throw new Error("Binance invalid response");
  return parseBinanceKlines(data);
}

/** Coinbase: [ time, low, high, open, close, volume ] */
function parseCoinbaseCandles(raw: unknown): OHLCVBar[] {
  if (!Array.isArray(raw)) return [];
  const out: OHLCVBar[] = [];
  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 6) continue;
    const t = Number(row[0]);
    const low = Number(row[1]);
    const high = Number(row[2]);
    const open = Number(row[3]);
    const close = Number(row[4]);
    const vol = Number(row[5]);
    if (!Number.isFinite(t) || !Number.isFinite(close)) continue;
    out.push({
      time: t,
      open,
      high,
      low,
      close,
      volume: Number.isFinite(vol) ? vol : 0,
    });
  }
  return out.sort((a, b) => a.time - b.time);
}

export async function fetchCoinbaseOHLCV(
  symbol: string,
  timeframe: ChartTimeframeKey
): Promise<OHLCVBar[]> {
  const tf = TF_MAP[timeframe];
  if (tf.coinbaseGranularity == null) throw new Error("Coinbase granularity N/A");
  const product = toCoinbaseProduct(symbol);
  const gran = tf.coinbaseGranularity;
  const now = Math.floor(Date.now() / 1000);
  const span = tf.binanceLimit * gran;
  const start = now - span;
  const url = `https://api.exchange.coinbase.com/products/${encodeURIComponent(product)}/candles?granularity=${gran}&start=${start}&end=${now}`;
  const res = await fetch(url, { next: { revalidate: 60 } });
  if (!res.ok) throw new Error(`Coinbase ${res.status}`);
  const data = (await res.json()) as unknown;
  return parseCoinbaseCandles(data);
}

/** CoinGecko OHLC: [timestamp_ms, open, high, low, close] — no volume */
function parseGeckoOhlc(raw: unknown): OHLCVBar[] {
  if (!Array.isArray(raw)) return [];
  const out: OHLCVBar[] = [];
  for (const row of raw) {
    if (!Array.isArray(row) || row.length < 5) continue;
    const t = Math.floor(Number(row[0]) / 1000);
    const o = Number(row[1]);
    const h = Number(row[2]);
    const l = Number(row[3]);
    const c = Number(row[4]);
    if (!Number.isFinite(t) || !Number.isFinite(c)) continue;
    out.push({ time: t, open: o, high: h, low: l, close: c, volume: 0 });
  }
  return out.sort((a, b) => a.time - b.time);
}

export async function fetchCoinGeckoOHLCV(coinId: string, timeframe: ChartTimeframeKey): Promise<OHLCVBar[]> {
  const days = TF_MAP[timeframe].geckoDays;
  const url = `https://api.coingecko.com/api/v3/coins/${encodeURIComponent(coinId)}/ohlc?vs_currency=usd&days=${days}`;
  const res = await fetch(url, { next: { revalidate: 120 } });
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const data = (await res.json()) as unknown;
  return parseGeckoOhlc(data);
}

function packAligned(
  ohlcv: OHLCVBar[],
  timeframe: ChartTimeframeKey,
  source: string
): { ohlcv: OHLCVBar[]; source: string } {
  return { ohlcv: ohlcv.length ? alignOhlcvBars(ohlcv, timeframe) : ohlcv, source };
}

export async function fetchOHLCVWithFallback(
  symbol: string,
  timeframe: ChartTimeframeKey,
  geckoCoinId?: string | null
): Promise<{ ohlcv: OHLCVBar[]; source: string }> {
  const errors: string[] = [];
  try {
    const ohlcv = await fetchBinanceOHLCV(symbol, timeframe);
    if (ohlcv.length) return packAligned(ohlcv, timeframe, "binance");
    errors.push("Binance empty");
  } catch (e) {
    errors.push(`Binance: ${e instanceof Error ? e.message : "fail"}`);
  }

  try {
    const ohlcv = await fetchCoinbaseOHLCV(symbol, timeframe);
    if (ohlcv.length) return packAligned(ohlcv, timeframe, "coinbase");
    errors.push("Coinbase empty");
  } catch (e) {
    errors.push(`Coinbase: ${e instanceof Error ? e.message : "fail"}`);
  }

  if (geckoCoinId && geckoCoinId.trim()) {
    try {
      const ohlcv = await fetchCoinGeckoOHLCV(geckoCoinId.trim().toLowerCase(), timeframe);
      if (ohlcv.length) return packAligned(ohlcv, timeframe, "coingecko");
      errors.push("CoinGecko empty");
    } catch (e) {
      errors.push(`CoinGecko: ${e instanceof Error ? e.message : "fail"}`);
    }
  }

  throw new Error(errors.join("; ") || "No OHLCV source available");
}
