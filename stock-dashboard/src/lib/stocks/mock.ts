import type { Candle, Quote } from "@/types/stock";
import { normalizeInput } from "./normalize";

const KNOWN_NAMES: Record<string, string> = {
  AAPL: "Apple Inc.",
  MSFT: "Microsoft Corporation",
  GOOGL: "Alphabet Inc.",
  AMZN: "Amazon.com, Inc.",
  TSLA: "Tesla, Inc.",
  NVDA: "NVIDIA Corporation",
  META: "Meta Platforms, Inc.",
  NFLX: "Netflix, Inc.",
  "005930.KS": "삼성전자",
  "000660.KS": "SK하이닉스",
  "035420.KS": "NAVER",
  "035720.KS": "카카오",
  "005380.KS": "현대차",
  "051910.KS": "LG화학",
  "207940.KS": "삼성바이오로직스",
  "068270.KS": "셀트리온",
};

function seededRandom(seed: number) {
  let value = seed % 2147483647;
  if (value <= 0) value += 2147483646;
  return () => {
    value = (value * 16807) % 2147483647;
    return value / 2147483647;
  };
}

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function mockQuote(input: string): Quote {
  const { ticker, market, symbol } = normalizeInput(input);
  const seed = hashString(symbol);
  const rand = seededRandom(seed);
  const basePrice = market === "KR" ? 30000 + rand() * 200000 : 50 + rand() * 500;
  const drift = (rand() - 0.5) * 0.06;
  const price = basePrice * (1 + drift);
  const previousClose = basePrice;
  const change = price - previousClose;
  const changePercent = (change / previousClose) * 100;
  return {
    ticker,
    symbol,
    name: KNOWN_NAMES[symbol] ?? KNOWN_NAMES[ticker] ?? ticker,
    market,
    price: Number(price.toFixed(market === "KR" ? 0 : 2)),
    previousClose: Number(previousClose.toFixed(market === "KR" ? 0 : 2)),
    change: Number(change.toFixed(market === "KR" ? 0 : 2)),
    changePercent: Number(changePercent.toFixed(2)),
    currency: market === "KR" ? "KRW" : "USD",
    volume: Math.round(rand() * 10_000_000),
    marketCap: Math.round(price * (1_000_000 + rand() * 1_000_000_000)),
    dayHigh: Number((price * (1 + rand() * 0.02)).toFixed(market === "KR" ? 0 : 2)),
    dayLow: Number((price * (1 - rand() * 0.02)).toFixed(market === "KR" ? 0 : 2)),
    updatedAt: Date.now(),
  };
}

export function mockHistory(input: string, days = 180): Candle[] {
  const { symbol, market } = normalizeInput(input);
  const seed = hashString(symbol);
  const rand = seededRandom(seed);
  const base = market === "KR" ? 30000 + rand() * 200000 : 50 + rand() * 500;
  const candles: Candle[] = [];
  let price = base;
  const now = Date.now();
  const dayMs = 86_400_000;
  for (let i = days; i >= 0; i--) {
    const ts = Math.floor((now - i * dayMs) / 1000);
    const trend = Math.sin((days - i) / 18) * 0.005;
    const noise = (rand() - 0.5) * 0.04;
    const open = price;
    const close = price * (1 + trend + noise);
    const high = Math.max(open, close) * (1 + rand() * 0.015);
    const low = Math.min(open, close) * (1 - rand() * 0.015);
    const volume = Math.round(rand() * 5_000_000);
    const decimals = market === "KR" ? 0 : 2;
    candles.push({
      time: ts,
      open: Number(open.toFixed(decimals)),
      high: Number(high.toFixed(decimals)),
      low: Number(low.toFixed(decimals)),
      close: Number(close.toFixed(decimals)),
      volume,
    });
    price = close;
  }
  return candles;
}
