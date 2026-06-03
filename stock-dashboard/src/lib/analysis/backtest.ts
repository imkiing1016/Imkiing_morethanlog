import type { Candle, Quote, Market } from "@/types/stock";
import { ema } from "@/lib/stocks/indicators";
import { computeVerdict } from "./engine";

// 백테스트: 과거 일봉으로 신호를 재현해 N일 후 실제 등락과 비교.
// ⚠️ 펀더멘털/수급/컨센서스는 과거 스냅샷이 없어 "기술적 신호"만 검증한다.
// 신규 다요인 엔진(기술 축) vs 단순 추세(이전 방식 근사)를 같은 기간에 비교.

export interface StratStat {
  signals: number;
  hits: number;
  hitRate: number; // %
  avgReturn: number; // % (신호 발동 후 N일 평균 수익률)
}

export interface StrategyResult {
  buy: StratStat;
  sell: StratStat;
  directionalAccuracy: number; // (매수 적중 + 매도 적중) / (매수+매도 신호) %
}

export interface BacktestResult {
  ticker: string;
  samples: number;
  horizon: number; // 검증 일수
  spanDays: number;
  baseUpRate: number; // 전체 구간에서 N일 후 상승했던 비율(기준선)
  buyHoldReturn: number; // 구간 매수후보유 수익률 %
  engine: StrategyResult;
  naive: StrategyResult;
  improvement: number; // 방향 정확도 차이(%p): engine - naive
}

function synthQuote(candles: Candle[], market: Market): Quote {
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2] ?? last;
  const change = last.close - prev.close;
  return {
    ticker: "",
    symbol: "",
    name: "",
    market,
    price: last.close,
    previousClose: prev.close,
    change,
    changePercent: prev.close ? (change / prev.close) * 100 : 0,
    currency: market === "KR" ? "KRW" : "USD",
    volume: last.volume,
    updatedAt: 0,
    source: "naver",
  };
}

function emptyStat(): { ret: number[]; hits: number } {
  return { ret: [], hits: 0 };
}

function finalize(buy: { ret: number[]; hits: number }, sell: { ret: number[]; hits: number }): StrategyResult {
  const stat = (x: { ret: number[]; hits: number }): StratStat => {
    const n = x.ret.length;
    const avg = n ? (x.ret.reduce((a, b) => a + b, 0) / n) * 100 : 0;
    return {
      signals: n,
      hits: x.hits,
      hitRate: n ? (x.hits / n) * 100 : 0,
      avgReturn: avg,
    };
  };
  const b = stat(buy);
  const s = stat(sell);
  const totalSig = b.signals + s.signals;
  const totalHit = b.hits + s.hits;
  return {
    buy: b,
    sell: s,
    directionalAccuracy: totalSig ? (totalHit / totalSig) * 100 : 0,
  };
}

interface BacktestOptions {
  horizon?: number; // 검증 일수 (기본 5)
  minLookback?: number; // 신호 생성 최소 봉 수 (기본 60)
}

export function runBacktest(
  ticker: string,
  candles: Candle[],
  market: Market,
  opts: BacktestOptions = {},
): BacktestResult | null {
  const horizon = opts.horizon ?? 5;
  const minLookback = opts.minLookback ?? 60;
  if (candles.length < minLookback + horizon + 10) return null;

  const engBuy = emptyStat();
  const engSell = emptyStat();
  const naiveBuy = emptyStat();
  const naiveSell = emptyStat();
  let upCount = 0;
  let total = 0;

  for (let t = minLookback; t < candles.length - horizon; t++) {
    const slice = candles.slice(0, t + 1);
    const fwd = (candles[t + horizon].close - candles[t].close) / candles[t].close;
    total += 1;
    if (fwd > 0) upCount += 1;

    // 신규 엔진 (기술 축만 — 펀더멘털/수급/시장 미입력)
    const v = computeVerdict({ quote: synthQuote(slice, market), candles: slice });
    if (v.recommendation === "buy" || v.recommendation === "strong_buy") {
      engBuy.ret.push(fwd);
      if (fwd > 0) engBuy.hits += 1;
    } else if (v.recommendation === "sell" || v.recommendation === "reduce") {
      engSell.ret.push(fwd);
      if (fwd < 0) engSell.hits += 1;
    }

    // 단순 추세 (이전 방식 근사): 종가 vs EMA20
    const e20 = ema(slice, 20).at(-1)?.value;
    if (e20 != null) {
      if (candles[t].close >= e20) {
        naiveBuy.ret.push(fwd);
        if (fwd > 0) naiveBuy.hits += 1;
      } else {
        naiveSell.ret.push(fwd);
        if (fwd < 0) naiveSell.hits += 1;
      }
    }
  }

  const engine = finalize(engBuy, engSell);
  const naive = finalize(naiveBuy, naiveSell);
  const first = candles[minLookback].close;
  const last = candles[candles.length - 1].close;
  const spanDays = candles.length - minLookback;

  return {
    ticker,
    samples: total,
    horizon,
    spanDays,
    baseUpRate: total ? (upCount / total) * 100 : 0,
    buyHoldReturn: first ? ((last - first) / first) * 100 : 0,
    engine,
    naive,
    improvement: engine.directionalAccuracy - naive.directionalAccuracy,
  };
}
