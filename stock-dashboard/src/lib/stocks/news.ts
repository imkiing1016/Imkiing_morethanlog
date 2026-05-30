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

interface NaverNewsItem {
  title?: string;
  officeName?: string;
  datetime?: string; // "20260529160000" 형태
  bodyText?: string;
  linkUrl?: string;
  articleId?: string;
  officeId?: string;
}

interface NaverNewsBody {
  title?: string;
  items?: NaverNewsItem[];
}

/** "20260529160000" -> epoch ms */
function parseNaverDate(s?: string): number {
  if (!s) return Date.now();
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

function mapNaverItems(raw: NaverNewsItem[], limit: number): NewsItem[] {
  return raw
    .filter((n) => n.title)
    .slice(0, limit)
    .map((n) => ({
      title: (n.title ?? "").replace(/<[^>]+>/g, "").trim(),
      link:
        n.linkUrl ??
        (n.officeId && n.articleId
          ? `https://n.news.naver.com/mnews/article/${n.officeId}/${n.articleId}`
          : "https://m.stock.naver.com/"),
      publishedAt: parseNaverDate(n.datetime),
      source: n.officeName,
      description: n.bodyText ? n.bodyText.replace(/<[^>]+>/g, "").slice(0, 200).trim() : undefined,
    }));
}

export async function getStockNews(input: string, limit = 8): Promise<NewsItem[]> {
  if (process.env.STOCK_DATA_MODE === "mock") return mockNews(input, limit);
  const { market, symbol } = normalizeInput(input);
  try {
    let url: string;
    if (market === "KR") {
      const code = symbol.replace(/\.(KS|KQ)$/i, "");
      url = `https://m.stock.naver.com/api/news/stock/${encodeURIComponent(code)}?pageSize=${limit}&page=1`;
    } else {
      const resolved = await resolveReutersCode(symbol);
      if (!resolved) throw new Error(`news: cannot resolve ${symbol}`);
      url = `https://m.stock.naver.com/api/news/worldStock/${encodeURIComponent(
        resolved.code,
      )}?pageSize=${limit}&page=1`;
    }
    const res = await fetch(url, { headers: NAVER_HEADERS, next: { revalidate: 600 } });
    if (!res.ok) throw new Error(`Naver news ${res.status}`);
    const json = (await res.json()) as NaverNewsBody[] | NaverNewsBody;
    // 응답이 [{items:[...]}] 또는 {items:[...]} 형태일 수 있음
    const groups = Array.isArray(json) ? json : [json];
    const items = groups.flatMap((g) => g.items ?? []);
    const mapped = mapNaverItems(items, limit);
    if (mapped.length === 0) throw new Error("news: empty");
    return mapped;
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[naver] news ${symbol} failed, using mock`, err);
    }
    return mockNews(input, limit);
  }
}

export async function getMarketNews(limit = 10): Promise<NewsItem[]> {
  if (process.env.STOCK_DATA_MODE === "mock") return mockMarketNews(limit);
  try {
    // 주요 증시 뉴스 (네이버 금융 뉴스 - 시황)
    const url = `https://m.stock.naver.com/api/news/mainNews?pageSize=${limit}&page=1`;
    const res = await fetch(url, { headers: NAVER_HEADERS, next: { revalidate: 600 } });
    if (!res.ok) throw new Error(`Naver market news ${res.status}`);
    const json = (await res.json()) as NaverNewsBody[] | NaverNewsBody;
    const groups = Array.isArray(json) ? json : [json];
    const items = groups.flatMap((g) => g.items ?? []);
    const mapped = mapNaverItems(items, limit);
    if (mapped.length === 0) throw new Error("market news: empty");
    return mapped;
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[naver] market news failed, using mock`, err);
    }
    return mockMarketNews(limit);
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

function mockMarketNews(limit: number): NewsItem[] {
  const now = Date.now();
  const titles = [
    "코스피 증시 시황",
    "코스닥 증시 시황",
    "원/달러 환율 동향",
    "미국 증시 마감 시황",
    "반도체 업종 동향",
    "2차전지 업종 동향",
    "Fed 금리 전망",
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
