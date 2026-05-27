import type { Market } from "@/types/stock";

export interface SearchResult {
  symbol: string;
  ticker: string;
  name: string;
  market: Market;
  exchange?: string;
  type?: string;
}

const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
};

interface YahooSearchResponse {
  quotes?: Array<{
    symbol?: string;
    shortname?: string;
    longname?: string;
    exchange?: string;
    quoteType?: string;
    typeDisp?: string;
  }>;
}

const KR_EXCHANGES = new Set(["KSC", "KOE", "KOQ"]);

function detectMarketFromExchange(symbol: string, exchange?: string): Market {
  if (symbol.endsWith(".KS") || symbol.endsWith(".KQ")) return "KR";
  if (exchange && KR_EXCHANGES.has(exchange)) return "KR";
  if (/^\d{6}(\.[A-Z]{2})?$/.test(symbol)) return "KR";
  return "US";
}

function toDisplayTicker(symbol: string): string {
  return symbol.replace(/\.(KS|KQ)$/i, "");
}

export async function searchSymbols(query: string, limit = 10): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  if (process.env.STOCK_DATA_MODE === "mock") return mockSearch(query, limit);
  const url = new URL("https://query2.finance.yahoo.com/v1/finance/search");
  url.searchParams.set("q", query.trim());
  url.searchParams.set("quotesCount", String(limit));
  url.searchParams.set("newsCount", "0");
  url.searchParams.set("listsCount", "0");
  try {
    const res = await fetch(url.toString(), {
      headers: YAHOO_HEADERS,
      next: { revalidate: 3600 },
    });
    if (!res.ok) throw new Error(`Yahoo search ${res.status}`);
    const json = (await res.json()) as YahooSearchResponse;
    const quotes = json.quotes ?? [];
    return quotes
      .filter((q) => q.symbol && (q.quoteType === "EQUITY" || q.quoteType === "ETF" || q.quoteType === "INDEX"))
      .map((q) => {
        const symbol = q.symbol as string;
        const market = detectMarketFromExchange(symbol, q.exchange);
        return {
          symbol,
          ticker: toDisplayTicker(symbol),
          name: q.longname ?? q.shortname ?? symbol,
          market,
          exchange: q.exchange,
          type: q.typeDisp ?? q.quoteType,
        };
      })
      .slice(0, limit);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[yahoo] search "${query}" failed, using mock`, err);
    }
    return mockSearch(query, limit);
  }
}

function mockSearch(query: string, limit: number): SearchResult[] {
  const q = query.trim().toUpperCase();
  const pool: SearchResult[] = [
    { symbol: "AAPL", ticker: "AAPL", name: "Apple Inc.", market: "US", type: "Equity" },
    { symbol: "MSFT", ticker: "MSFT", name: "Microsoft Corporation", market: "US", type: "Equity" },
    { symbol: "NVDA", ticker: "NVDA", name: "NVIDIA Corporation", market: "US", type: "Equity" },
    { symbol: "TSLA", ticker: "TSLA", name: "Tesla, Inc.", market: "US", type: "Equity" },
    { symbol: "GOOGL", ticker: "GOOGL", name: "Alphabet Inc.", market: "US", type: "Equity" },
    { symbol: "AMZN", ticker: "AMZN", name: "Amazon.com, Inc.", market: "US", type: "Equity" },
    { symbol: "META", ticker: "META", name: "Meta Platforms, Inc.", market: "US", type: "Equity" },
    { symbol: "005930.KS", ticker: "005930", name: "삼성전자", market: "KR", type: "Equity" },
    { symbol: "000660.KS", ticker: "000660", name: "SK하이닉스", market: "KR", type: "Equity" },
    { symbol: "035420.KS", ticker: "035420", name: "NAVER", market: "KR", type: "Equity" },
    { symbol: "035720.KS", ticker: "035720", name: "카카오", market: "KR", type: "Equity" },
    { symbol: "207940.KS", ticker: "207940", name: "삼성바이오로직스", market: "KR", type: "Equity" },
  ];
  return pool
    .filter(
      (r) =>
        r.symbol.includes(q) ||
        r.ticker.includes(q) ||
        r.name.toUpperCase().includes(q) ||
        r.name.includes(query.trim()),
    )
    .slice(0, limit);
}
