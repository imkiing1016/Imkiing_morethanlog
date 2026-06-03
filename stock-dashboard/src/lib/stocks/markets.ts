// 시장 지수/환율 - 네이버 금융 (비공식). 한국 IP에서 실시간 동작.

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

const NAVER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  Referer: "https://finance.naver.com/",
};

function parseNum(value: unknown): number | undefined {
  if (value == null) return undefined;
  const n = Number(String(value).replace(/,/g, "").trim());
  return Number.isFinite(n) ? n : undefined;
}

interface NaverIndexData {
  closePrice?: string;
  closePriceRaw?: string;
  compareToPreviousClosePrice?: string;
  compareToPreviousClosePriceRaw?: string;
  compareToPreviousPrice?: { code?: string };
  fluctuationsRatio?: string;
  fluctuationsRatioRaw?: string;
}

interface NaverIndexResponse {
  datas?: NaverIndexData[];
}

/** 네이버 지수/환율 폴링 응답(datas[0]) 파싱 - raw 필드(콤마 없음) 우선 */
function parseIndexData(
  d: NaverIndexData,
  def: { symbol: string; name: string; region: "KR" | "US" | "FX"; currency: string },
): MarketIndex | null {
  const price = parseNum(d.closePriceRaw ?? d.closePrice);
  if (price == null) return null;
  const dirCode = d.compareToPreviousPrice?.code;
  const isDown = dirCode === "4" || dirCode === "5";
  const rawChange = parseNum(d.compareToPreviousClosePriceRaw ?? d.compareToPreviousClosePrice) ?? 0;
  const change = isDown ? -Math.abs(rawChange) : Math.abs(rawChange);
  const rawRatio = parseNum(d.fluctuationsRatioRaw ?? d.fluctuationsRatio) ?? 0;
  const changePercent = isDown ? -Math.abs(rawRatio) : Math.abs(rawRatio);
  return {
    symbol: def.symbol,
    ticker: def.symbol,
    name: def.name,
    price,
    previousClose: price - change,
    change,
    changePercent,
    currency: def.currency,
    region: def.region,
  };
}

interface IndexDef {
  symbol: string;
  name: string;
  region: "KR" | "US" | "FX";
  currency: string;
  url: string;
}

// 국내 지수: 확인된 엔드포인트. 해외 지수/환율은 동일 응답 형식(datas[])로 시도.
const INDEX_DEFS: IndexDef[] = [
  {
    symbol: "KOSPI",
    name: "KOSPI",
    region: "KR",
    currency: "KRW",
    url: "https://polling.finance.naver.com/api/realtime/domestic/index/KOSPI",
  },
  {
    symbol: "KOSDAQ",
    name: "KOSDAQ",
    region: "KR",
    currency: "KRW",
    url: "https://polling.finance.naver.com/api/realtime/domestic/index/KOSDAQ",
  },
  {
    symbol: ".INX",
    name: "S&P 500",
    region: "US",
    currency: "USD",
    url: "https://polling.finance.naver.com/api/realtime/worldstock/index/.INX",
  },
  {
    symbol: ".IXIC",
    name: "Nasdaq",
    region: "US",
    currency: "USD",
    url: "https://polling.finance.naver.com/api/realtime/worldstock/index/.IXIC",
  },
  {
    symbol: ".DJI",
    name: "Dow Jones",
    region: "US",
    currency: "USD",
    url: "https://polling.finance.naver.com/api/realtime/worldstock/index/.DJI",
  },
  {
    symbol: "FX_USDKRW",
    name: "USD/KRW",
    region: "FX",
    currency: "KRW",
    url: "https://polling.finance.naver.com/api/realtime/exchange/FX_USDKRW",
  },
];

export async function getMarketIndices(): Promise<MarketIndex[]> {
  const results = await Promise.all(
    INDEX_DEFS.map(async (def) => {
      try {
        const res = await fetch(def.url, { headers: NAVER_HEADERS, next: { revalidate: 30 } });
        if (!res.ok) throw new Error(`Naver index ${def.symbol} ${res.status}`);
        const json = (await res.json()) as NaverIndexResponse;
        const d = json.datas?.[0];
        if (!d) return null;
        return parseIndexData(d, def);
      } catch (err) {
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[naver] index ${def.symbol} failed`, err);
        }
        return null;
      }
    }),
  );
  return results.filter((r): r is MarketIndex => r !== null);
}
