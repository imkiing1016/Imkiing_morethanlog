import type { Candle, Quote, Range } from "@/types/stock";
import { normalizeInput } from "./normalize";

// 네이버 금융 (비공식) 데이터 소스 - 한국 주식 전용
// 한국 IP에서 실시간 동작. API 키 불필요.

const NAVER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  Referer: "https://m.stock.naver.com/",
};

/** "317,000" 또는 "1,234.5" -> number */
function parseNum(value: unknown): number | undefined {
  if (value == null) return undefined;
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : undefined;
}

/** 005930.KS / 005930 -> 005930 (네이버는 6자리 숫자 코드만 사용) */
function toNaverCode(input: string): string {
  return input.trim().toUpperCase().replace(/\.(KS|KQ)$/i, "");
}

interface NaverBasic {
  stockName?: string;
  closePrice?: string;
  compareToPreviousClosePrice?: string;
  compareToPreviousPrice?: { code?: string; text?: string };
  fluctuationsRatio?: string;
  openPrice?: string;
  highPrice?: string;
  lowPrice?: string;
  accumulatedTradingVolume?: string;
  marketStatus?: string;
}

/**
 * 네이버 금융 종목 시세 (한국 주식)
 * code(2/5=상승, 4/5는 하락 계열)로 부호 판정 후 전일대비/등락률 계산
 */
export async function getNaverQuote(input: string): Promise<Quote> {
  const { ticker, market } = normalizeInput(input);
  const code = toNaverCode(input);
  const url = `https://m.stock.naver.com/api/stock/${encodeURIComponent(code)}/basic`;

  const res = await fetch(url, { headers: NAVER_HEADERS, next: { revalidate: 15 } });
  if (!res.ok) throw new Error(`Naver basic ${res.status}`);
  const json = (await res.json()) as NaverBasic;

  const price = parseNum(json.closePrice);
  if (price == null) throw new Error("Naver: missing closePrice");

  // 등락 부호: compareToPreviousPrice.code 우선, 없으면 fluctuationsRatio 부호
  const dirCode = json.compareToPreviousPrice?.code;
  const isDown = dirCode === "4" || dirCode === "5";
  const rawChange = parseNum(json.compareToPreviousClosePrice) ?? 0;
  const change = isDown ? -Math.abs(rawChange) : Math.abs(rawChange);
  const previousClose = price - change;
  const rawRatio = parseNum(json.fluctuationsRatio) ?? 0;
  const changePercent = isDown ? -Math.abs(rawRatio) : Math.abs(rawRatio);

  return {
    ticker,
    symbol: code,
    name: json.stockName ?? ticker,
    market,
    price,
    previousClose,
    change,
    changePercent,
    currency: "KRW",
    volume: parseNum(json.accumulatedTradingVolume) ?? 0,
    dayHigh: parseNum(json.highPrice),
    dayLow: parseNum(json.lowPrice),
    updatedAt: Date.now(),
    source: "naver",
  };
}

/**
 * 네이버 금융 일봉 시세 (한국 주식)
 * siseJson.naver는 JS 배열 리터럴(작은따옴표) 텍스트를 반환하므로 직접 파싱한다.
 * 형식: [['날짜','시가','고가','저가','종가','거래량','외국인소진율'], ['20240102', 79600, ...], ...]
 */
export async function getNaverHistory(input: string, range: Range = "6mo"): Promise<Candle[]> {
  const code = toNaverCode(input);
  const days = rangeToDays(range);
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

  const url = `https://api.finance.naver.com/siseJson.naver?symbol=${encodeURIComponent(
    code,
  )}&requestType=1&startTime=${fmt(start)}&endTime=${fmt(end)}&timeframe=day`;

  const res = await fetch(url, { headers: NAVER_HEADERS, next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Naver siseJson ${res.status}`);
  const text = (await res.text()).trim();

  // 작은따옴표 -> 큰따옴표 변환 후 JSON 파싱
  let rows: unknown[][];
  try {
    rows = JSON.parse(text.replace(/'/g, '"')) as unknown[][];
  } catch {
    throw new Error("Naver siseJson: parse failed");
  }
  if (!Array.isArray(rows) || rows.length < 2) throw new Error("Naver siseJson: empty");

  const candles: Candle[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!Array.isArray(row) || row.length < 5) continue;
    const dateStr = String(row[0]); // "20240102"
    const y = Number(dateStr.slice(0, 4));
    const mo = Number(dateStr.slice(4, 6));
    const d = Number(dateStr.slice(6, 8));
    if (!y || !mo || !d) continue;
    const time = Math.floor(Date.UTC(y, mo - 1, d) / 1000);
    const open = parseNum(row[1]);
    const high = parseNum(row[2]);
    const low = parseNum(row[3]);
    const close = parseNum(row[4]);
    const volume = parseNum(row[5]) ?? 0;
    if (open == null || high == null || low == null || close == null) continue;
    candles.push({ time, open, high, low, close, volume });
  }
  if (candles.length === 0) throw new Error("Naver siseJson: no candles");
  return candles;
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
