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
