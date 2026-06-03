import { normalizeInput } from "./normalize";
import { resolveReutersCode } from "./naver-world";

// 뉴스 - 네이버 금융 뉴스 API (비공식). 한국 IP에서 동작.
// 종목별 뉴스: 국내 6자리 코드 / 해외 로이터코드 기반.

export interface NewsItem {
  title: string;
  link: string;
  publishedAt: number;
  source?: string;
  description?: string;
}

const NAVER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  Referer: "https://m.stock.naver.com/",
};

type Json = Record<string, unknown>;

/** HTML 엔티티/태그 제거 (&quot; &amp; &#39; 등) */
function clean(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .trim();
}

function str(obj: Json, keys: string[]): string | undefined {
  for (const k of keys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim()) return v;
    if (typeof v === "number") return String(v);
  }
  return undefined;
}

/** "20260529160000" / "2026-05-29T16:00:00" / epoch -> ms */
function parseNaverDate(s?: string): number {
  if (!s) return Date.now();
  if (/^\d{13}$/.test(s)) return Number(s);
  if (s.includes("-") || s.includes("T")) {
    const t = new Date(s).getTime();
    if (Number.isFinite(t)) return t;
  }
  const d = s.replace(/\D/g, "");
  if (d.length < 8) return Date.now();
  const y = Number(d.slice(0, 4));
  const mo = Number(d.slice(4, 6));
  const da = Number(d.slice(6, 8));
  const h = Number(d.slice(8, 10) || "0");
  const mi = Number(d.slice(10, 12) || "0");
  const t = new Date(y, mo - 1, da, h, mi).getTime();
  return Number.isFinite(t) ? t : Date.now();
}

/** 응답(JSON)에서 뉴스처럼 보이는 항목 배열을 재귀적으로 찾는다 */
function findNewsArray(node: unknown, depth = 0): Json[] {
  if (depth > 5 || node == null) return [];
  if (Array.isArray(node)) {
    const looksLikeNews = node.some(
      (it) => it && typeof it === "object" && str(it as Json, ["title", "headline", "titleText"]),
    );
    if (looksLikeNews) return node as Json[];
    return node.flatMap((n) => findNewsArray(n, depth + 1));
  }
  if (typeof node === "object") {
    return Object.values(node as Json).flatMap((v) => findNewsArray(v, depth + 1));
  }
  return [];
}

function mapNaverItems(raw: Json[], limit: number): NewsItem[] {
  return raw
    .map((n) => {
      const title = str(n, ["title", "headline", "titleText"]);
      if (!title) return null;
      const officeId = str(n, ["officeId", "pressId"]);
      const articleId = str(n, ["articleId", "id", "newsId"]);
      const link =
        str(n, ["linkUrl", "url", "bodyUrl", "mobileUrl"]) ??
        (officeId && articleId
          ? `https://n.news.naver.com/mnews/article/${officeId}/${articleId}`
          : undefined);
      const body = str(n, ["bodyText", "summary", "body", "content"]);
      const cleanTitle = clean(title);
      return {
        title: cleanTitle,
        link: link ?? `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(cleanTitle)}`,
        publishedAt: parseNaverDate(str(n, ["datetime", "date", "createdDateTime", "officeDateTime", "dateTime"])),
        source: str(n, ["officeName", "pressName", "mediaName", "source"]),
        description: body ? clean(body).slice(0, 200) : undefined,
      } as NewsItem;
    })
    .filter((n): n is NewsItem => n !== null)
    .slice(0, limit);
}

async function fetchNaverNews(url: string, limit: number): Promise<NewsItem[]> {
  const res = await fetch(url, { headers: NAVER_HEADERS, next: { revalidate: 600 } });
  if (!res.ok) throw new Error(`Naver news ${res.status}`);
  const json = (await res.json()) as unknown;
  const items = findNewsArray(json);
  const mapped = mapNaverItems(items, limit);
  if (mapped.length === 0) throw new Error("news: empty");
  return mapped;
}

export async function getStockNews(input: string, limit = 8): Promise<NewsItem[]> {
  if (process.env.STOCK_DATA_MODE === "mock") return mockNews(input, limit);
  const { market, symbol } = normalizeInput(input);
  try {
    let url: string;
    if (market === "KR") {
      const code = symbol.replace(/\.(KS|KQ)$/i, "");
      url = `https://m.stock.naver.com/front-api/news/stock/list?itemCode=${encodeURIComponent(
        code,
      )}&page=1&pageSize=${limit}`;
    } else {
      const resolved = await resolveReutersCode(symbol);
      if (!resolved) throw new Error(`news: cannot resolve ${symbol}`);
      url = `https://m.stock.naver.com/front-api/news/worldStock/list?reutersCode=${encodeURIComponent(
        resolved.code,
      )}&page=1&pageSize=${limit}`;
    }
    return await fetchNaverNews(url, limit);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[naver] news ${symbol} failed, using mock`, err);
    }
    return mockNews(input, limit);
  }
}

export async function getMarketNews(limit = 10, market: "KR" | "US" = "KR"): Promise<NewsItem[]> {
  if (process.env.STOCK_DATA_MODE === "mock") return mockMarketNews(limit, market);
  try {
    if (market === "US") {
      // 미국 시장 대표로 S&P500 ETF(SPY) 뉴스를 사용
      return await getStockNews("SPY", limit);
    }
    // 국내: 시총 1위(삼성전자=005930) 피드(코스피/거시/대형주 시황 다수 포함)
    const url = `https://m.stock.naver.com/front-api/news/stock/list?itemCode=005930&page=1&pageSize=${limit}`;
    return await fetchNaverNews(url, limit);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[naver] market news (${market}) failed, using mock`, err);
    }
    return mockMarketNews(limit, market);
  }
}

/** 네이버 뉴스 검색 링크 (mock 헤드라인도 클릭 시 실제 관련 뉴스가 열리도록) */
function naverNewsSearch(query: string): string {
  return `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(query)}`;
}

function mockNews(input: string, limit: number): NewsItem[] {
  const { ticker } = normalizeInput(input);
  const seed = ticker.toUpperCase();
  const now = Date.now();
  const templates = [
    `${seed} 분기 실적, 시장 예상치 상회`,
    `애널리스트, ${seed} 목표주가 상향 조정`,
    `${seed}, 신제품 발표로 상승세`,
    `${seed} CEO, 향후 성장 전략 발표`,
    `${seed} 관련 규제 이슈 부각`,
    `기관 투자자, ${seed} 매수세 강화`,
    `${seed}, 자사주 매입 발표`,
    `${seed} 배당 정책 변경 검토`,
  ];
  return templates.slice(0, limit).map((title, i) => ({
    title,
    link: naverNewsSearch(`${seed} 주가`),
    publishedAt: now - i * 3600 * 1000,
    source: "네이버 뉴스 검색",
    description: "실시간 뉴스 연동 준비 중입니다. 클릭하면 네이버 뉴스 검색 결과가 열립니다.",
  }));
}

function mockMarketNews(limit: number, market: "KR" | "US" = "KR"): NewsItem[] {
  const now = Date.now();
  const titles =
    market === "US"
      ? [
          "미국 증시 마감 시황 (S&P500·나스닥)",
          "Fed 기준금리 전망",
          "엔비디아·AI 반도체 동향",
          "미국 빅테크 실적 동향",
          "미 국채 금리·달러 동향",
          "국제 유가 동향",
          "테슬라·전기차 시장 동향",
          "미국 고용·물가 지표",
        ]
      : [
          "코스피 증시 시황",
          "코스닥 증시 시황",
          "원/달러 환율 동향",
          "반도체 업종 동향",
          "2차전지 업종 동향",
          "외국인·기관 매매 동향",
          "Fed 금리와 국내 증시",
          "국제 유가 동향",
        ];
  return titles.slice(0, limit).map((title, i) => ({
    title,
    link: naverNewsSearch(title),
    publishedAt: now - i * 1800000,
    source: "네이버 뉴스 검색",
    description: "클릭하면 네이버 뉴스 검색 결과가 열립니다.",
  }));
}
