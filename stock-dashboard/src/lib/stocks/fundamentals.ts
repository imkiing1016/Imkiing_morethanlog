import { normalizeInput } from "./normalize";
import { resolveReutersCode } from "./naver-world";
import { getKrIntegration } from "./kr-integration";
import type { Market } from "@/types/stock";

// 펀더멘털(재무) - 네이버 금융 basic 응답의 stockItemTotalInfos에서 추출.
// 네이버가 제공하는 지표: PER, PBR, EPS, BPS, 배당수익률, 배당금, 52주 고/저, 시가총액.
// (미제공 지표는 undefined → UI에서 "—" 표기)

export interface Fundamentals {
  ticker: string;
  symbol: string;
  market: Market;
  peRatio?: number;
  pbRatio?: number;
  eps?: number;
  bps?: number;
  dividendYield?: number; // 비율 (0.0233 = 2.33%)
  dividendRate?: number;
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
  marketCap?: number;
  // 네이버 미제공(향후 확장 여지). 현재는 undefined.
  forwardPe?: number;
  forwardEps?: number;
  payoutRatio?: number;
  beta?: number;
  roe?: number;
  profitMargin?: number;
  revenueGrowth?: number;
  earningsGrowth?: number;
  debtToEquity?: number;
  currentRatio?: number;
  fiftyDayAvg?: number;
  twoHundredDayAvg?: number;
  totalRevenue?: number;
  freeCashflow?: number;
  totalDebt?: number;
  source: "naver" | "mock";
  updatedAt: number;
}

const NAVER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  Referer: "https://m.stock.naver.com/",
};

interface TotalInfoItem {
  code?: string;
  value?: string;
}

interface NaverBasic {
  stockItemTotalInfos?: TotalInfoItem[];
}

/** "30.26배", "8.94", "1,234" 등에서 숫자 추출. "N/A" -> undefined */
function parseInfoNum(value?: string): number | undefined {
  if (!value || value.includes("N/A")) return undefined;
  const cleaned = value.replace(/,/g, "").match(/-?\d+(\.\d+)?/);
  if (!cleaned) return undefined;
  const n = Number(cleaned[0]);
  return Number.isFinite(n) ? n : undefined;
}

/** "2.33%" -> 0.0233 */
function parsePctRatio(value?: string): number | undefined {
  const n = parseInfoNum(value);
  return n == null ? undefined : n / 100;
}

/** "2조 9,113억 USD" / "4,387조 3,353억원" -> 숫자 */
function parseKoreanMoney(value?: string): number | undefined {
  if (!value || value.includes("N/A")) return undefined;
  const v = value.replace(/,/g, "");
  let total = 0;
  let matched = false;
  const jo = v.match(/(\d+(?:\.\d+)?)\s*조/);
  if (jo) {
    total += Number(jo[1]) * 1e12;
    matched = true;
  }
  const eok = v.match(/(\d+(?:\.\d+)?)\s*억/);
  if (eok) {
    total += Number(eok[1]) * 1e8;
    matched = true;
  }
  if (matched) return total;
  return parseInfoNum(value);
}

export async function getFundamentals(input: string): Promise<Fundamentals> {
  const { ticker, market, symbol } = normalizeInput(input);
  if (process.env.STOCK_DATA_MODE === "mock") {
    return mockFundamentals(ticker, symbol, market);
  }

  // 국내 종목: integration 엔드포인트(PER/PBR/EPS/BPS/배당/시총 실데이터)
  if (market === "KR") {
    try {
      const kr = await getKrIntegration(input);
      const f = kr?.fundamentals;
      if (f && (f.per != null || f.pbr != null)) {
        return {
          ticker,
          symbol,
          market,
          peRatio: f.per,
          forwardPe: f.forwardPer,
          pbRatio: f.pbr,
          eps: f.eps,
          forwardEps: f.forwardEps,
          bps: f.bps,
          dividendYield: f.dividendYield,
          dividendRate: f.dividendRate,
          fiftyTwoWeekHigh: f.fiftyTwoWeekHigh,
          fiftyTwoWeekLow: f.fiftyTwoWeekLow,
          marketCap: f.marketCap,
          source: "naver",
          updatedAt: Date.now(),
        };
      }
      throw new Error("KR integration: no fundamentals");
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        console.warn(`[naver] KR fundamentals ${symbol} failed, using mock`, err);
      }
      return mockFundamentals(ticker, symbol, market);
    }
  }

  try {
    // 해외 종목: world basic 엔드포인트 — stockItemTotalInfos에 재무지표 포함
    const resolved = await resolveReutersCode(ticker);
    if (!resolved) throw new Error(`fundamentals: cannot resolve ${ticker}`);
    const url = `https://api.stock.naver.com/stock/${encodeURIComponent(resolved.code)}/basic`;
    const res = await fetch(url, { headers: NAVER_HEADERS, next: { revalidate: 1800 } });
    if (!res.ok) throw new Error(`Naver fundamentals ${res.status}`);
    const json = (await res.json()) as NaverBasic;
    const infos = new Map(
      (json.stockItemTotalInfos ?? []).map((it) => [it.code ?? "", it.value ?? ""]),
    );
    if (infos.size === 0) throw new Error("fundamentals: no totalInfos");

    return {
      ticker,
      symbol,
      market,
      peRatio: parseInfoNum(infos.get("per")),
      pbRatio: parseInfoNum(infos.get("pbr")),
      eps: parseInfoNum(infos.get("eps")),
      bps: parseInfoNum(infos.get("bps")),
      dividendYield: parsePctRatio(infos.get("dividendYieldRatio")),
      dividendRate: parseInfoNum(infos.get("dividend")),
      fiftyTwoWeekHigh: parseInfoNum(infos.get("highPriceOf52Weeks")),
      fiftyTwoWeekLow: parseInfoNum(infos.get("lowPriceOf52Weeks")),
      marketCap: parseKoreanMoney(infos.get("marketValue")),
      source: "naver",
      updatedAt: Date.now(),
    };
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[naver] fundamentals ${symbol} failed, using mock`, err);
    }
    return mockFundamentals(ticker, symbol, market);
  }
}

function mockFundamentals(ticker: string, symbol: string, market: Market): Fundamentals {
  const seed = Array.from(ticker).reduce((a, c) => a + c.charCodeAt(0), 0);
  const rand = (offset: number) => (Math.sin(seed + offset) + 1) / 2;
  return {
    ticker,
    symbol,
    market,
    peRatio: 15 + rand(1) * 35,
    pbRatio: 1 + rand(3) * 8,
    eps: 2 + rand(4) * 12,
    bps: 20 + rand(5) * 80,
    dividendYield: rand(6) * 0.04,
    dividendRate: rand(7) * 5,
    fiftyTwoWeekHigh: 100 + rand(16) * 400,
    fiftyTwoWeekLow: 50 + rand(17) * 200,
    marketCap: 1e10 + rand(22) * 1e12,
    roe: rand(10) * 0.4,
    profitMargin: 0.05 + rand(11) * 0.3,
    revenueGrowth: -0.05 + rand(12) * 0.3,
    source: "mock",
    updatedAt: Date.now(),
  };
}
