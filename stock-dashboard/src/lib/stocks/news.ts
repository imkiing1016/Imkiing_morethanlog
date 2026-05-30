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
    link: "https://m.stock.naver.com/",
    publishedAt: now - i * 3600 * 1000,
    source: "샘플 뉴스",
    description: "샘플 뉴스 데이터입니다. 실제 환경에서는 네이버 금융 뉴스가 표시됩니다.",
  }));
}

function mockMarketNews(limit: number): NewsItem[] {
  const now = Date.now();
  const items: NewsItem[] = [
    { title: "Fed, 금리 동결 시그널... 시장 안도", link: "#", publishedAt: now - 1800000, source: "샘플" },
    { title: "코스피, 외국인 매수세에 상승 마감", link: "#", publishedAt: now - 3600000, source: "샘플" },
    { title: "엔비디아 실적 발표 앞두고 AI 종목 강세", link: "#", publishedAt: now - 5400000, source: "샘플" },
    { title: "원/달러 환율, 일주일새 최저치 경신", link: "#", publishedAt: now - 7200000, source: "샘플" },
    { title: "삼성전자, HBM3E 양산 본격화", link: "#", publishedAt: now - 9000000, source: "샘플" },
    { title: "테슬라, 새로운 자율주행 업데이트 공개", link: "#", publishedAt: now - 10800000, source: "샘플" },
    { title: "유가 상승, 정유주 강세", link: "#", publishedAt: now - 12600000, source: "샘플" },
    { title: "비트코인, 6만 달러 돌파", link: "#", publishedAt: now - 14400000, source: "샘플" },
  ];
  return items.slice(0, limit);
}
