import type { Market } from "@/types/stock";

const KR_DIGIT_RE = /^\d{6}$/;
const KR_SUFFIX_RE = /\.(KS|KQ)$/i;

export function detectMarket(input: string): Market {
  const trimmed = input.trim().toUpperCase();
  if (KR_SUFFIX_RE.test(trimmed)) return "KR";
  if (KR_DIGIT_RE.test(trimmed)) return "KR";
  return "US";
}

export function toYahooSymbol(ticker: string, market: Market): string {
  const trimmed = ticker.trim().toUpperCase();
  if (market === "US") return trimmed;
  if (KR_SUFFIX_RE.test(trimmed)) return trimmed;
  return `${trimmed}.KS`;
}

export function displayTicker(symbol: string): string {
  return symbol.replace(KR_SUFFIX_RE, "").toUpperCase();
}

export function normalizeInput(input: string): { ticker: string; market: Market; symbol: string } {
  const market = detectMarket(input);
  const symbol = toYahooSymbol(input, market);
  const ticker = displayTicker(symbol);
  return { ticker, market, symbol };
}
