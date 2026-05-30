import type { Market } from "@/types/stock";

export interface SearchResult {
  symbol: string;
  ticker: string;
  name: string;
  market: Market;
  exchange?: string;
  type?: string;
}

interface NaverAutoCompleteItem {
  reutersCode?: string;
  symbolCode?: string;
  name?: string;
  typeName?: string;
  nationName?: string;
  nationCode?: string;
}

interface NaverAutoCompleteResponse {
  result?: { items?: NaverAutoCompleteItem[] };
}

export async function searchSymbols(query: string, limit = 10): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  if (process.env.STOCK_DATA_MODE === "mock") return mockSearch(query, limit);

  // 네이버 통합검색 자동완성 (국내 + 해외, 한국 IP에서 동작)
  const url = `https://m.stock.naver.com/front-api/search/autoComplete?query=${encodeURIComponent(
    query.trim(),
  )}&target=stock,etf,index`;
  try {
    const res = await fetch(url, { headers: NAVER_SEARCH_HEADERS, next: { revalidate: 3600 } });
    if (!res.ok) throw new Error(`Naver autoComplete ${res.status}`);
    const json = (await res.json()) as NaverAutoCompleteResponse;
    const items = json.result?.items ?? [];
    const results = items
      .filter((it) => it.symbolCode || it.reutersCode)
      .map((it) => {
        const ticker = (it.symbolCode ?? it.reutersCode ?? "").replace(/\.[A-Z]+$/i, "");
        const isKr =
          /^\d{6}$/.test(ticker) ||
          it.nationCode === "KOR" ||
          (it.nationName ?? "").includes("국내");
        const market: Market = isKr ? "KR" : "US";
        return {
          symbol: it.reutersCode ?? ticker,
          ticker,
          name: it.name ?? ticker,
          market,
          exchange: it.nationName,
          type: it.typeName,
        };
      })
      .slice(0, limit);
    if (results.length > 0) return results;
    return mockSearch(query, limit);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[naver] search "${query}" failed, using mock`, err);
    }
    return mockSearch(query, limit);
  }
}

const NAVER_SEARCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  Referer: "https://m.stock.naver.com/",
};

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
