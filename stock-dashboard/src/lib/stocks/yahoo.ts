import type { Candle, Quote, Range } from "@/types/stock";
import { displayTicker, normalizeInput } from "./normalize";
import { mockHistory, mockQuote } from "./mock";

const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
};

const USE_MOCK = process.env.STOCK_DATA_MODE === "mock";

async function fetchYahooChart(symbol: string, range: Range | "5d" | "1d", interval = "1d") {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol,
  )}?interval=${interval}&range=${range}`;
  const res = await fetch(url, { headers: YAHOO_HEADERS, next: { revalidate: 30 } });
  if (!res.ok) throw new Error(`Yahoo chart ${res.status}`);
  const json = (await res.json()) as YahooChartResponse;
  const error = json.chart?.error;
  if (error) throw new Error(error.description ?? error.code ?? "yahoo error");
  const result = json.chart?.result?.[0];
  if (!result) throw new Error("yahoo: empty result");
  return result;
}

export async function getQuote(input: string): Promise<Quote> {
  const { ticker, market, symbol } = normalizeInput(input);
  if (USE_MOCK) return mockQuote(input);
  try {
    const result = await fetchYahooChart(symbol, "5d");
    const meta = result.meta;
    const price = meta.regularMarketPrice ?? meta.previousClose ?? 0;
    const previousClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
    const change = price - previousClose;
    const changePercent = previousClose ? (change / previousClose) * 100 : 0;
    return {
      ticker: displayTicker(meta.symbol ?? symbol),
      symbol: meta.symbol ?? symbol,
      name: meta.longName ?? meta.shortName ?? ticker,
      market,
      price: Number(price.toFixed(market === "KR" ? 0 : 4)),
      previousClose: Number(previousClose.toFixed(market === "KR" ? 0 : 4)),
      change: Number(change.toFixed(market === "KR" ? 0 : 4)),
      changePercent: Number(changePercent.toFixed(2)),
      currency: meta.currency ?? (market === "KR" ? "KRW" : "USD"),
      volume: meta.regularMarketVolume ?? 0,
      marketCap: meta.marketCap,
      dayHigh: meta.regularMarketDayHigh,
      dayLow: meta.regularMarketDayLow,
      updatedAt: Date.now(),
    };
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[yahoo] quote ${symbol} failed, using mock`, err);
    }
    return mockQuote(input);
  }
}

export async function getQuotes(inputs: string[]): Promise<Quote[]> {
  const settled = await Promise.allSettled(inputs.map((i) => getQuote(i)));
  return settled
    .filter((r): r is PromiseFulfilledResult<Quote> => r.status === "fulfilled")
    .map((r) => r.value);
}

export async function getHistory(input: string, range: Range = "6mo"): Promise<Candle[]> {
  const { symbol } = normalizeInput(input);
  if (USE_MOCK) return mockHistory(input, rangeToDays(range));
  try {
    const result = await fetchYahooChart(symbol, range);
    const ts = result.timestamp ?? [];
    const quote = result.indicators?.quote?.[0];
    if (!quote) throw new Error("yahoo: missing quote series");
    const candles: Candle[] = [];
    for (let i = 0; i < ts.length; i++) {
      const open = quote.open?.[i];
      const high = quote.high?.[i];
      const low = quote.low?.[i];
      const close = quote.close?.[i];
      const volume = quote.volume?.[i];
      if (open == null || high == null || low == null || close == null) continue;
      candles.push({
        time: ts[i],
        open,
        high,
        low,
        close,
        volume: volume ?? 0,
      });
    }
    return candles;
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[yahoo] history ${symbol} failed, using mock`, err);
    }
    return mockHistory(input, rangeToDays(range));
  }
}

function rangeToDays(range: Range): number {
  switch (range) {
    case "1mo":
      return 30;
    case "3mo":
      return 90;
    case "6mo":
      return 180;
    case "1y":
      return 365;
    case "2y":
      return 730;
    case "5y":
      return 1825;
    case "max":
      return 3650;
  }
}

interface YahooChartResponse {
  chart?: {
    result?: Array<{
      meta: {
        symbol?: string;
        regularMarketPrice?: number;
        previousClose?: number;
        chartPreviousClose?: number;
        longName?: string;
        shortName?: string;
        currency?: string;
        regularMarketVolume?: number;
        marketCap?: number;
        regularMarketDayHigh?: number;
        regularMarketDayLow?: number;
      };
      timestamp?: number[];
      indicators?: {
        quote?: Array<{
          open?: (number | null)[];
          high?: (number | null)[];
          low?: (number | null)[];
          close?: (number | null)[];
          volume?: (number | null)[];
        }>;
      };
    }>;
    error?: { code?: string; description?: string };
  };
}
