import type { Candle, Quote, Range } from "@/types/stock";
import { normalizeInput } from "./normalize";

// 네이버 해외증시 (비공식) - 미국 등 해외 주식 전용
// 티커(AAPL) -> 로이터코드(AAPL.O) 해석 후 시세 조회. 한국 IP에서 동작, API 키 불필요.

const NAVER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  Referer: "https://m.stock.naver.com/",
};

function parseNum(value: unknown): number | undefined {
  if (value == null) return undefined;
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : undefined;
}

interface AutoCompleteItem {
  code?: string; // 네이버 자동완성의 심볼 필드는 'code' (예: "AMZN")
  reutersCode?: string; // 예: "AMZN.O"
  name?: string;
  typeName?: string;
}

interface AutoCompleteResponse {
  result?: { items?: AutoCompleteItem[] };
}

/** 티커 -> 네이버 로이터코드(예: AAPL -> AAPL.O). 해석 실패 시 null */
async function resolveReutersCode(ticker: string): Promise<{ code: string; name?: string } | null> {
  const q = ticker.trim().toUpperCase();
  const url = `https://m.stock.naver.com/front-api/search/autoComplete?query=${encodeURIComponent(
    q,
  )}&target=stock,etf,index`;
  const res = await fetch(url, { headers: NAVER_HEADERS, next: { revalidate: 86400 } });
  if (!res.ok) throw new Error(`Naver autoComplete ${res.status}`);
  const json = (await res.json()) as AutoCompleteResponse;
  const items = json.result?.items ?? [];
  if (items.length === 0) return null;
  // 심볼(code) 정확 일치 우선, 없으면 첫 결과
  const exact = items.find((it) => (it.code ?? "").toUpperCase() === q && it.reutersCode);
  const pick = exact ?? items.find((it) => it.reutersCode);
  if (!pick?.reutersCode) return null;
  return { code: pick.reutersCode, name: pick.name };
}

interface TotalInfoItem {
  code?: string;
  value?: string;
}

interface NaverWorldBasic {
  stockName?: string;
  stockNameEng?: string;
  symbolCode?: string;
  closePrice?: string;
  compareToPreviousClosePrice?: string;
  compareToPreviousPrice?: { code?: string };
  fluctuationsRatio?: string;
  currencyType?: { code?: string };
  // 고가/저가/거래량/전일종가 등은 이 배열 안에 code-value 쌍으로 들어있음
  stockItemTotalInfos?: TotalInfoItem[];
}

/** 네이버 해외주식 시세 (미국 등) */
export async function getNaverWorldQuote(input: string): Promise<Quote> {
  const { ticker, market } = normalizeInput(input);
  const resolved = await resolveReutersCode(ticker);
  if (!resolved) throw new Error(`Naver world: cannot resolve ${ticker}`);

  const url = `https://api.stock.naver.com/stock/${encodeURIComponent(resolved.code)}/basic`;
  const res = await fetch(url, { headers: NAVER_HEADERS, next: { revalidate: 15 } });
  if (!res.ok) throw new Error(`Naver world basic ${res.status}`);
  const json = (await res.json()) as NaverWorldBasic;

  const price = parseNum(json.closePrice);
  if (price == null) throw new Error("Naver world: missing closePrice");

  const dirCode = json.compareToPreviousPrice?.code;
  const isDown = dirCode === "4" || dirCode === "5";
  const rawChange = parseNum(json.compareToPreviousClosePrice) ?? 0;
  const change = isDown ? -Math.abs(rawChange) : Math.abs(rawChange);
  const rawRatio = parseNum(json.fluctuationsRatio) ?? 0;
  const changePercent = isDown ? -Math.abs(rawRatio) : Math.abs(rawRatio);

  // stockItemTotalInfos: [{code:"basePrice",value:"274.00"}, {code:"highPrice",...}, ...]
  const infos = new Map(
    (json.stockItemTotalInfos ?? []).map((it) => [it.code ?? "", it.value ?? ""]),
  );
  const basePrice = parseNum(infos.get("basePrice"));
  const previousClose = basePrice ?? price - change;

  return {
    ticker,
    symbol: json.symbolCode ?? ticker,
    name: json.stockNameEng ?? json.stockName ?? resolved.name ?? ticker,
    market,
    price: Number(price.toFixed(4)),
    previousClose: Number(previousClose.toFixed(4)),
    change: Number(change.toFixed(4)),
    changePercent: Number(changePercent.toFixed(2)),
    currency: json.currencyType?.code ?? "USD",
    volume: parseNum(infos.get("accumulatedTradingVolume")) ?? 0,
    dayHigh: parseNum(infos.get("highPrice")),
    dayLow: parseNum(infos.get("lowPrice")),
    updatedAt: Date.now(),
    source: "naver",
  };
}

interface WorldCandleRow {
  localDate?: string | number;
  openPrice?: number | string;
  highPrice?: number | string;
  lowPrice?: number | string;
  closePrice?: number | string;
  accumulatedTradingVolume?: number | string;
}

/** 네이버 해외주식 일봉 */
export async function getNaverWorldHistory(input: string, range: Range = "6mo"): Promise<Candle[]> {
  const { ticker } = normalizeInput(input);
  const resolved = await resolveReutersCode(ticker);
  if (!resolved) throw new Error(`Naver world: cannot resolve ${ticker}`);

  const days = rangeToDays(range);
  const end = new Date();
  const start = new Date(end.getTime() - days * 86_400_000);
  const fmt = (d: Date) =>
    `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;

  const url = `https://api.stock.naver.com/chart/foreign/item/${encodeURIComponent(
    resolved.code,
  )}/day?startDateTime=${fmt(start)}0000&endDateTime=${fmt(end)}2359`;
  const res = await fetch(url, { headers: NAVER_HEADERS, next: { revalidate: 300 } });
  if (!res.ok) throw new Error(`Naver world chart ${res.status}`);
  const json = (await res.json()) as unknown;

  // 응답이 배열이거나 {priceInfos:[...]} 형태일 수 있어 방어적으로 추출
  const rows: WorldCandleRow[] = Array.isArray(json)
    ? (json as WorldCandleRow[])
    : ((json as { priceInfos?: WorldCandleRow[]; chartInfos?: WorldCandleRow[] }).priceInfos ??
      (json as { chartInfos?: WorldCandleRow[] }).chartInfos ??
      []);

  const candles: Candle[] = [];
  for (const row of rows) {
    const dateStr = String(row.localDate ?? "");
    const digits = dateStr.replace(/\D/g, "");
    if (digits.length < 8) continue;
    const y = Number(digits.slice(0, 4));
    const mo = Number(digits.slice(4, 6));
    const d = Number(digits.slice(6, 8));
    const open = parseNum(row.openPrice);
    const high = parseNum(row.highPrice);
    const low = parseNum(row.lowPrice);
    const close = parseNum(row.closePrice);
    if (!y || !mo || !d || open == null || high == null || low == null || close == null) continue;
    candles.push({
      time: Math.floor(Date.UTC(y, mo - 1, d) / 1000),
      open,
      high,
      low,
      close,
      volume: parseNum(row.accumulatedTradingVolume) ?? 0,
    });
  }
  if (candles.length === 0) throw new Error("Naver world chart: no candles");
  // 오름차순 보장
  candles.sort((a, b) => a.time - b.time);
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
