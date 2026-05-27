import { getQuote } from "./yahoo";

export interface MarketIndex {
  symbol: string;
  ticker: string;
  name: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  currency: string;
  region: "KR" | "US" | "FX";
}

const INDEX_DEFS: Array<{ symbol: string; name: string; region: "KR" | "US" | "FX" }> = [
  { symbol: "^KS11", name: "KOSPI", region: "KR" },
  { symbol: "^KQ11", name: "KOSDAQ", region: "KR" },
  { symbol: "^GSPC", name: "S&P 500", region: "US" },
  { symbol: "^IXIC", name: "Nasdaq", region: "US" },
  { symbol: "^DJI", name: "Dow Jones", region: "US" },
  { symbol: "KRW=X", name: "USD/KRW", region: "FX" },
];

export async function getMarketIndices(): Promise<MarketIndex[]> {
  const results = await Promise.all(
    INDEX_DEFS.map(async (def) => {
      try {
        const q = await getQuote(def.symbol);
        return {
          symbol: def.symbol,
          ticker: q.ticker || def.symbol,
          name: def.name,
          price: q.price,
          previousClose: q.previousClose,
          change: q.change,
          changePercent: q.changePercent,
          currency: q.currency,
          region: def.region,
        };
      } catch {
        return null;
      }
    }),
  );
  return results.filter((r): r is MarketIndex => r !== null);
}
