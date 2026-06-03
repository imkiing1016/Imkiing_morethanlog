import type { Candle } from "@/types/stock";

export interface IndicatorPoint {
  time: number;
  value: number;
}

export function sma(candles: Candle[], period: number): IndicatorPoint[] {
  const out: IndicatorPoint[] = [];
  if (candles.length < period) return out;
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) sum -= candles[i - period].close;
    if (i >= period - 1) {
      out.push({ time: candles[i].time, value: sum / period });
    }
  }
  return out;
}

export function ema(candles: Candle[], period: number): IndicatorPoint[] {
  const out: IndicatorPoint[] = [];
  if (candles.length < period) return out;
  const k = 2 / (period + 1);
  let prev = candles.slice(0, period).reduce((s, c) => s + c.close, 0) / period;
  out.push({ time: candles[period - 1].time, value: prev });
  for (let i = period; i < candles.length; i++) {
    const value = candles[i].close * k + prev * (1 - k);
    out.push({ time: candles[i].time, value });
    prev = value;
  }
  return out;
}

export function rsi(candles: Candle[], period = 14): IndicatorPoint[] {
  const out: IndicatorPoint[] = [];
  if (candles.length <= period) return out;
  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    if (diff >= 0) gains += diff;
    else losses -= diff;
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  const firstRs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  out.push({
    time: candles[period].time,
    value: 100 - 100 / (1 + firstRs),
  });
  for (let i = period + 1; i < candles.length; i++) {
    const diff = candles[i].close - candles[i - 1].close;
    const gain = diff > 0 ? diff : 0;
    const loss = diff < 0 ? -diff : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
    out.push({
      time: candles[i].time,
      value: 100 - 100 / (1 + rs),
    });
  }
  return out;
}

export interface MacdPoint {
  time: number;
  macd: number;
  signal: number;
  histogram: number;
}

export function macd(
  candles: Candle[],
  fast = 12,
  slow = 26,
  signalPeriod = 9,
): MacdPoint[] {
  const emaFast = ema(candles, fast);
  const emaSlow = ema(candles, slow);
  const fastMap = new Map(emaFast.map((p) => [p.time, p.value]));
  const macdLine: IndicatorPoint[] = emaSlow
    .map((p) => {
      const fastVal = fastMap.get(p.time);
      if (fastVal == null) return null;
      return { time: p.time, value: fastVal - p.value };
    })
    .filter((p): p is IndicatorPoint => p !== null);
  if (macdLine.length < signalPeriod) return [];
  const k = 2 / (signalPeriod + 1);
  let prev =
    macdLine.slice(0, signalPeriod).reduce((s, p) => s + p.value, 0) / signalPeriod;
  const out: MacdPoint[] = [];
  out.push({
    time: macdLine[signalPeriod - 1].time,
    macd: macdLine[signalPeriod - 1].value,
    signal: prev,
    histogram: macdLine[signalPeriod - 1].value - prev,
  });
  for (let i = signalPeriod; i < macdLine.length; i++) {
    const signalValue = macdLine[i].value * k + prev * (1 - k);
    out.push({
      time: macdLine[i].time,
      macd: macdLine[i].value,
      signal: signalValue,
      histogram: macdLine[i].value - signalValue,
    });
    prev = signalValue;
  }
  return out;
}

export function latest<T extends { value?: number }>(series: T[]): T | undefined {
  return series.length ? series[series.length - 1] : undefined;
}

export function trendLabel(value: number): "up" | "down" | "flat" {
  if (value > 0.5) return "up";
  if (value < -0.5) return "down";
  return "flat";
}

// ----- 고급 지표 (전문 분석용) -----

export interface BollingerPoint {
  time: number;
  middle: number;
  upper: number;
  lower: number;
  /** %B: 밴드 내 위치 (0=하단, 1=상단) */
  percentB: number;
  /** 밴드폭 비율 (변동성) */
  bandwidth: number;
}

export function bollinger(candles: Candle[], period = 20, mult = 2): BollingerPoint[] {
  const out: BollingerPoint[] = [];
  if (candles.length < period) return out;
  for (let i = period - 1; i < candles.length; i++) {
    const slice = candles.slice(i - period + 1, i + 1);
    const mean = slice.reduce((s, c) => s + c.close, 0) / period;
    const variance = slice.reduce((s, c) => s + (c.close - mean) ** 2, 0) / period;
    const sd = Math.sqrt(variance);
    const upper = mean + mult * sd;
    const lower = mean - mult * sd;
    const close = candles[i].close;
    const percentB = upper === lower ? 0.5 : (close - lower) / (upper - lower);
    out.push({
      time: candles[i].time,
      middle: mean,
      upper,
      lower,
      percentB,
      bandwidth: mean ? ((upper - lower) / mean) * 100 : 0,
    });
  }
  return out;
}

/** ATR (변동성) - 가격 대비 비율(%)도 함께 */
export function atr(candles: Candle[], period = 14): IndicatorPoint[] {
  const out: IndicatorPoint[] = [];
  if (candles.length <= period) return out;
  const trs: number[] = [];
  for (let i = 1; i < candles.length; i++) {
    const h = candles[i].high;
    const l = candles[i].low;
    const pc = candles[i - 1].close;
    trs.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
  }
  let prev = trs.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out.push({ time: candles[period].time, value: prev });
  for (let i = period; i < trs.length; i++) {
    prev = (prev * (period - 1) + trs[i]) / period;
    out.push({ time: candles[i + 1].time, value: prev });
  }
  return out;
}

export interface StochPoint {
  time: number;
  k: number;
  d: number;
}

export function stochastic(candles: Candle[], kPeriod = 14, dPeriod = 3): StochPoint[] {
  if (candles.length < kPeriod) return [];
  const kRaw: { time: number; k: number }[] = [];
  for (let i = kPeriod - 1; i < candles.length; i++) {
    const slice = candles.slice(i - kPeriod + 1, i + 1);
    const hh = Math.max(...slice.map((c) => c.high));
    const ll = Math.min(...slice.map((c) => c.low));
    const k = hh === ll ? 50 : ((candles[i].close - ll) / (hh - ll)) * 100;
    kRaw.push({ time: candles[i].time, k });
  }
  const out: StochPoint[] = [];
  for (let i = dPeriod - 1; i < kRaw.length; i++) {
    const d = kRaw.slice(i - dPeriod + 1, i + 1).reduce((s, p) => s + p.k, 0) / dPeriod;
    out.push({ time: kRaw[i].time, k: kRaw[i].k, d });
  }
  return out;
}

/** OBV (누적 거래량 - 매집/분산 추세) */
export function obv(candles: Candle[]): IndicatorPoint[] {
  const out: IndicatorPoint[] = [];
  if (candles.length === 0) return out;
  let acc = 0;
  out.push({ time: candles[0].time, value: 0 });
  for (let i = 1; i < candles.length; i++) {
    if (candles[i].close > candles[i - 1].close) acc += candles[i].volume;
    else if (candles[i].close < candles[i - 1].close) acc -= candles[i].volume;
    out.push({ time: candles[i].time, value: acc });
  }
  return out;
}

/** 최근 N봉의 단순 지지/저항 (스윙 고저) */
export function supportResistance(candles: Candle[], lookback = 60): { support: number; resistance: number } | null {
  if (candles.length < 5) return null;
  const slice = candles.slice(-lookback);
  return {
    support: Math.min(...slice.map((c) => c.low)),
    resistance: Math.max(...slice.map((c) => c.high)),
  };
}

