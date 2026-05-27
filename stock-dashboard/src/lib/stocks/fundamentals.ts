import { normalizeInput } from "./normalize";
import type { Market } from "@/types/stock";

export interface Fundamentals {
  ticker: string;
  symbol: string;
  market: Market;
  peRatio?: number;
  forwardPe?: number;
  pbRatio?: number;
  eps?: number;
  forwardEps?: number;
  dividendYield?: number;
  dividendRate?: number;
  payoutRatio?: number;
  beta?: number;
  roe?: number;
  profitMargin?: number;
  revenueGrowth?: number;
  earningsGrowth?: number;
  debtToEquity?: number;
  currentRatio?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  fiftyDayAvg?: number;
  twoHundredDayAvg?: number;
  averageVolume?: number;
  sharesOutstanding?: number;
  totalCash?: number;
  totalDebt?: number;
  totalRevenue?: number;
  freeCashflow?: number;
  source: "yahoo" | "mock";
  updatedAt: number;
}

const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
};

interface YahooNumber {
  raw?: number;
  fmt?: string;
}

interface QuoteSummaryResult {
  summaryDetail?: {
    trailingPE?: YahooNumber;
    forwardPE?: YahooNumber;
    priceToBook?: YahooNumber;
    dividendYield?: YahooNumber;
    dividendRate?: YahooNumber;
    payoutRatio?: YahooNumber;
    beta?: YahooNumber;
    fiftyTwoWeekHigh?: YahooNumber;
    fiftyTwoWeekLow?: YahooNumber;
    fiftyDayAverage?: YahooNumber;
    twoHundredDayAverage?: YahooNumber;
    averageVolume?: YahooNumber;
  };
  defaultKeyStatistics?: {
    trailingEps?: YahooNumber;
    forwardEps?: YahooNumber;
    sharesOutstanding?: YahooNumber;
    profitMargins?: YahooNumber;
    priceToBook?: YahooNumber;
  };
  financialData?: {
    returnOnEquity?: YahooNumber;
    profitMargins?: YahooNumber;
    revenueGrowth?: YahooNumber;
    earningsGrowth?: YahooNumber;
    debtToEquity?: YahooNumber;
    currentRatio?: YahooNumber;
    totalCash?: YahooNumber;
    totalDebt?: YahooNumber;
    totalRevenue?: YahooNumber;
    freeCashflow?: YahooNumber;
  };
}

export async function getFundamentals(input: string): Promise<Fundamentals> {
  const { ticker, market, symbol } = normalizeInput(input);
  if (process.env.STOCK_DATA_MODE === "mock") {
    return mockFundamentals(ticker, symbol, market);
  }
  const modules = ["summaryDetail", "defaultKeyStatistics", "financialData"].join(",");
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(
    symbol,
  )}?modules=${modules}`;
  try {
    const res = await fetch(url, { headers: YAHOO_HEADERS, next: { revalidate: 1800 } });
    if (!res.ok) throw new Error(`Yahoo quoteSummary ${res.status}`);
    const json = (await res.json()) as {
      quoteSummary?: { result?: QuoteSummaryResult[] };
    };
    const result = json.quoteSummary?.result?.[0];
    if (!result) throw new Error("yahoo quoteSummary: empty");
    const sd = result.summaryDetail ?? {};
    const ks = result.defaultKeyStatistics ?? {};
    const fd = result.financialData ?? {};
    return {
      ticker,
      symbol,
      market,
      peRatio: sd.trailingPE?.raw,
      forwardPe: sd.forwardPE?.raw,
      pbRatio: sd.priceToBook?.raw ?? ks.priceToBook?.raw,
      eps: ks.trailingEps?.raw,
      forwardEps: ks.forwardEps?.raw,
      dividendYield: sd.dividendYield?.raw,
      dividendRate: sd.dividendRate?.raw,
      payoutRatio: sd.payoutRatio?.raw,
      beta: sd.beta?.raw,
      roe: fd.returnOnEquity?.raw,
      profitMargin: fd.profitMargins?.raw ?? ks.profitMargins?.raw,
      revenueGrowth: fd.revenueGrowth?.raw,
      earningsGrowth: fd.earningsGrowth?.raw,
      debtToEquity: fd.debtToEquity?.raw,
      currentRatio: fd.currentRatio?.raw,
      fiftyTwoWeekHigh: sd.fiftyTwoWeekHigh?.raw,
      fiftyTwoWeekLow: sd.fiftyTwoWeekLow?.raw,
      fiftyDayAvg: sd.fiftyDayAverage?.raw,
      twoHundredDayAvg: sd.twoHundredDayAverage?.raw,
      averageVolume: sd.averageVolume?.raw,
      sharesOutstanding: ks.sharesOutstanding?.raw,
      totalCash: fd.totalCash?.raw,
      totalDebt: fd.totalDebt?.raw,
      totalRevenue: fd.totalRevenue?.raw,
      freeCashflow: fd.freeCashflow?.raw,
      source: "yahoo",
      updatedAt: Date.now(),
    };
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[yahoo] fundamentals ${symbol} failed, using mock`, err);
    }
    return mockFundamentals(ticker, symbol, market);
  }
}

function mockFundamentals(ticker: string, symbol: string, market: Market): Fundamentals {
  const seed = Array.from(ticker).reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = (offset: number) => ((Math.sin(seed + offset) + 1) / 2);
  return {
    ticker,
    symbol,
    market,
    peRatio: 15 + rand(1) * 35,
    forwardPe: 12 + rand(2) * 30,
    pbRatio: 1 + rand(3) * 8,
    eps: 2 + rand(4) * 12,
    forwardEps: 2.5 + rand(5) * 14,
    dividendYield: rand(6) * 0.04,
    dividendRate: rand(7) * 5,
    payoutRatio: rand(8) * 0.6,
    beta: 0.5 + rand(9) * 1.5,
    roe: rand(10) * 0.4,
    profitMargin: 0.05 + rand(11) * 0.3,
    revenueGrowth: -0.05 + rand(12) * 0.3,
    earningsGrowth: -0.1 + rand(13) * 0.5,
    debtToEquity: rand(14) * 200,
    currentRatio: 0.8 + rand(15) * 2.2,
    fiftyTwoWeekHigh: 100 + rand(16) * 400,
    fiftyTwoWeekLow: 50 + rand(17) * 200,
    fiftyDayAvg: 100 + rand(18) * 300,
    twoHundredDayAvg: 90 + rand(19) * 280,
    averageVolume: 1e6 + rand(20) * 1e8,
    sharesOutstanding: 1e9 + rand(21) * 1e10,
    totalCash: 1e10 + rand(22) * 1e11,
    totalDebt: 1e10 + rand(23) * 5e10,
    totalRevenue: 1e10 + rand(24) * 5e11,
    freeCashflow: 1e9 + rand(25) * 1e11,
    source: "mock",
    updatedAt: Date.now(),
  };
}
