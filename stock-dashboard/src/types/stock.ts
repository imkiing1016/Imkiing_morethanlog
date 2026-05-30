import type { Market } from "@/lib/format";

export type { Market };

export interface Quote {
  ticker: string;
  symbol: string;
  name: string;
  market: Market;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  currency: string;
  volume: number;
  marketCap?: number;
  dayHigh?: number;
  dayLow?: number;
  updatedAt: number;
  source?: QuoteSource;
}

export type QuoteSource = "naver" | "yahoo" | "mock";

export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Interval = "1d" | "1wk" | "1mo";
export type Range = "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y" | "max";

export interface WatchItem {
  ticker: string;
  market: Market;
  name?: string;
  targetUp?: number;
  targetDown?: number;
  addedAt: number;
}

export interface MarketSentiment {
  score: number;
  label: string;
  components: SentimentComponent[];
  updatedAt: number;
}

export interface SentimentComponent {
  key: string;
  label: string;
  value: number;
  weight: number;
  description: string;
}

export interface AnalysisReport {
  ticker: string;
  generatedAt: number;
  summary: string;
  bullish: string[];
  bearish: string[];
  outlook: string;
  riskLevel: "low" | "medium" | "high";
  fromCache: boolean;
  source: "claude" | "mock";
}
