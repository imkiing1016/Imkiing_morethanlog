import { normalizeInput } from "./normalize";

// 네이버 국내종목 통합 정보 (integration 엔드포인트)
// PER/PBR/배당 + 투자자별 매매동향(외국인/기관/개인) + 컨센서스 목표주가

export interface KrFundamentals {
  per?: number;
  forwardPer?: number; // 추정 PER
  eps?: number;
  forwardEps?: number;
  pbr?: number;
  bps?: number;
  dividendYield?: number; // 비율 0.0046
  dividendRate?: number;
  marketCap?: number;
  foreignRate?: number; // 외인소진율 %
  fiftyTwoWeekHigh?: number;
  fiftyTwoWeekLow?: number;
}

export interface SupplyDay {
  date: string; // "20260602"
  foreigner: number; // 외국인 순매수 수량(+매수/-매도)
  organ: number; // 기관
  individual: number; // 개인
  foreignHoldRatio?: number;
}

export interface KrConsensus {
  recommMean?: number; // 투자의견 평균 (네이버: 높을수록 매수 우세, 1~5)
  priceTargetMean?: number; // 목표주가 컨센서스
}

export interface KrIntegration {
  fundamentals: KrFundamentals;
  supply: SupplyDay[];
  consensus?: KrConsensus;
}

const NAVER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  Referer: "https://m.stock.naver.com/",
};

function num(v?: string | number): number | undefined {
  if (v == null) return undefined;
  const cleaned = String(v).replace(/[,+\s]/g, "").match(/-?\d+(\.\d+)?/);
  if (!cleaned) return undefined;
  const n = Number(cleaned[0]);
  return Number.isFinite(n) ? n : undefined;
}

function pctRatio(v?: string): number | undefined {
  const n = num(v);
  return n == null ? undefined : n / 100;
}

/** "2,107조 5,834억" / "29,704,413백만" → 숫자(원) */
function koreanMoney(v?: string): number | undefined {
  if (!v) return undefined;
  const s = v.replace(/,/g, "");
  let total = 0;
  let matched = false;
  const jo = s.match(/(\d+(?:\.\d+)?)\s*조/);
  if (jo) {
    total += Number(jo[1]) * 1e12;
    matched = true;
  }
  const eok = s.match(/(\d+(?:\.\d+)?)\s*억/);
  if (eok) {
    total += Number(eok[1]) * 1e8;
    matched = true;
  }
  const baekman = s.match(/(\d+(?:\.\d+)?)\s*백만/);
  if (baekman && !matched) {
    total += Number(baekman[1]) * 1e6;
    matched = true;
  }
  return matched ? total : num(v);
}

interface TotalInfo {
  code?: string;
  value?: string;
}
interface DealTrend {
  bizdate?: string;
  foreignerPureBuyQuant?: string;
  organPureBuyQuant?: string;
  individualPureBuyQuant?: string;
  foreignerHoldRatio?: string;
}
interface IntegrationBody {
  totalInfos?: TotalInfo[];
  dealTrendInfos?: DealTrend[];
  consensusInfo?: { recommMean?: string; priceTargetMean?: string };
}

const cache = new Map<string, { value: KrIntegration; expires: number }>();
const TTL = 10 * 60_000;

export async function getKrIntegration(input: string): Promise<KrIntegration | null> {
  const { market, symbol } = normalizeInput(input);
  if (market !== "KR") return null;
  const code = symbol.replace(/\.(KS|KQ)$/i, "");
  if (process.env.STOCK_DATA_MODE === "mock") return null;

  const hit = cache.get(code);
  if (hit && hit.expires > Date.now()) return hit.value;

  const url = `https://m.stock.naver.com/api/stock/${encodeURIComponent(code)}/integration`;
  const res = await fetch(url, { headers: NAVER_HEADERS, next: { revalidate: 600 } });
  if (!res.ok) throw new Error(`Naver integration ${res.status}`);
  const json = (await res.json()) as IntegrationBody;

  const info = new Map((json.totalInfos ?? []).map((t) => [t.code ?? "", t.value ?? ""]));
  const fundamentals: KrFundamentals = {
    per: num(info.get("per")),
    forwardPer: num(info.get("cnsPer")),
    eps: num(info.get("eps")),
    forwardEps: num(info.get("cnsEps")),
    pbr: num(info.get("pbr")),
    bps: num(info.get("bps")),
    dividendYield: pctRatio(info.get("dividendYieldRatio")),
    dividendRate: num(info.get("dividend")),
    marketCap: koreanMoney(info.get("marketValue")),
    foreignRate: num(info.get("foreignRate")),
    fiftyTwoWeekHigh: num(info.get("highPriceOf52Weeks")),
    fiftyTwoWeekLow: num(info.get("lowPriceOf52Weeks")),
  };

  const supply: SupplyDay[] = (json.dealTrendInfos ?? []).slice(0, 10).map((d) => ({
    date: d.bizdate ?? "",
    foreigner: num(d.foreignerPureBuyQuant) ?? 0,
    organ: num(d.organPureBuyQuant) ?? 0,
    individual: num(d.individualPureBuyQuant) ?? 0,
    foreignHoldRatio: num(d.foreignerHoldRatio),
  }));

  const consensus: KrConsensus | undefined = json.consensusInfo
    ? {
        recommMean: num(json.consensusInfo.recommMean),
        priceTargetMean: num(json.consensusInfo.priceTargetMean),
      }
    : undefined;

  const value: KrIntegration = { fundamentals, supply, consensus };
  cache.set(code, { value, expires: Date.now() + TTL });
  return value;
}
