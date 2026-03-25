/**
 * Block70 chart math (mirrors apps/api chart scoring). Used for tests and client helpers.
 */

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export function calculateRSI(candles: Candle[], period = 14): number[] {
  const closes = candles.map((c) => c.close);
  const gains: number[] = [];
  const losses: number[] = [];

  for (let i = 1; i < closes.length; i++) {
    const diff = closes[i] - closes[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? Math.abs(diff) : 0);
  }

  if (gains.length < period) return [];

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  const rsi: number[] = [];

  for (let i = period; i < gains.length; i++) {
    avgGain = (avgGain * (period - 1) + gains[i]) / period;
    avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    rsi.push(100 - 100 / (1 + rs));
  }

  return rsi;
}

function ema(values: number[], period: number): number[] {
  const k = 2 / (period + 1);
  let emaPrev = values[0] ?? 0;
  return values.map((v) => {
    emaPrev = v * k + emaPrev * (1 - k);
    return emaPrev;
  });
}

/** MACD line (12/26 EMA diff) and signal (9 EMA of line), aligned to `closes`. */
export function calculateMACD(closes: number[]) {
  if (!closes.length) return { macd: [] as number[], signal: [] as number[] };
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macd = ema12.map((v, i) => v - ema26[i]);
  const signal = ema(macd, 9);
  return { macd, signal };
}

export function sma(values: number[], period: number): number[] {
  return values.map((_, i, arr) => {
    if (i < period - 1) return NaN;
    const slice = arr.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

export function volumeTrend(candles: Candle[]): number {
  if (candles.length < 20) return 1;
  const recent = candles.slice(-10);
  const prev = candles.slice(-20, -10);
  const recentAvg = recent.reduce((a, c) => a + c.volume, 0) / recent.length;
  const prevAvg = prev.reduce((a, c) => a + c.volume, 0) / prev.length;
  return prevAvg > 0 ? recentAvg / prevAvg : 1;
}

export function momentumScore(candles: Candle[]): number {
  if (candles.length < 7) return 0;
  const last = candles[candles.length - 1].close;
  const prev = candles[candles.length - 7].close;
  return prev > 0 ? (last - prev) / prev : 0;
}

export function calculateBlock70Score(candles: Candle[]): number {
  if (!candles.length) return 0;
  const closes = candles.map((c) => c.close);
  const rsiArr = calculateRSI(candles);
  const rsi = rsiArr.length ? rsiArr[rsiArr.length - 1] : NaN;
  const { macd, signal } = calculateMACD(closes);
  const macdLatest = macd[macd.length - 1] ?? NaN;
  const signalLatest = signal[signal.length - 1] ?? NaN;

  const ma50Arr = sma(closes, 50);
  const ma200Arr = sma(closes, 200);
  const ma50 = ma50Arr[ma50Arr.length - 1] ?? NaN;
  const ma200 = ma200Arr[ma200Arr.length - 1] ?? NaN;

  const volume = volumeTrend(candles);
  const momentum = momentumScore(candles);

  let score = 0;

  if (!Number.isNaN(rsi)) {
    if (rsi < 30) score += 20;
    else if (rsi < 60) score += 10;
  }

  if (!Number.isNaN(macdLatest) && !Number.isNaN(signalLatest)) {
    if (macdLatest > signalLatest) score += 20;
    else score += 5;
  } else {
    score += 5;
  }

  if (!Number.isNaN(ma50) && !Number.isNaN(ma200)) {
    if (ma50 > ma200) score += 15;
    else score += 5;
  } else {
    score += 5;
  }

  if (volume > 1.2) score += 15;
  else if (volume > 1) score += 8;

  if (momentum > 0.05) score += 15;
  else if (momentum > 0) score += 8;

  const volatility = Math.abs(momentum);
  if (volatility < 0.1) score += 10;
  else score += 5;

  return Math.min(100, Math.round(score));
}

export function getSignal(score: number): string {
  if (score >= 80) return "Strong Buy";
  if (score >= 60) return "Buy";
  if (score >= 40) return "Hold";
  if (score >= 20) return "Sell";
  return "Strong Sell";
}
