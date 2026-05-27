import { normalizeInput } from "./normalize";

export interface NewsItem {
  title: string;
  link: string;
  publishedAt: number;
  source?: string;
  description?: string;
}

const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/rss+xml,application/xml,text/xml,*/*",
};

function decodeEntities(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
}

function parseRss(xml: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item\b[^>]*>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "";
    const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? "";
    const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? "";
    const description = block.match(/<description>([\s\S]*?)<\/description>/)?.[1] ?? "";
    const source = block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1];
    if (!title || !link) continue;
    items.push({
      title: decodeEntities(title).trim(),
      link: decodeEntities(link).trim(),
      publishedAt: pubDate ? new Date(pubDate).getTime() : Date.now(),
      source: source ? decodeEntities(source).trim() : undefined,
      description: description ? decodeEntities(description).replace(/<[^>]+>/g, "").slice(0, 200).trim() : undefined,
    });
  }
  return items;
}

export async function getStockNews(input: string, limit = 8): Promise<NewsItem[]> {
  if (process.env.STOCK_DATA_MODE === "mock") return mockNews(input, limit);
  const { symbol, market } = normalizeInput(input);
  const region = market === "KR" ? "KR" : "US";
  const lang = market === "KR" ? "ko-KR" : "en-US";
  const url = `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodeURIComponent(
    symbol,
  )}&region=${region}&lang=${lang}`;
  try {
    const res = await fetch(url, { headers: YAHOO_HEADERS, next: { revalidate: 600 } });
    if (!res.ok) throw new Error(`Yahoo news ${res.status}`);
    const xml = await res.text();
    const items = parseRss(xml);
    return items.slice(0, limit);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[yahoo] news ${symbol} failed, using mock`, err);
    }
    return mockNews(input, limit);
  }
}

export async function getMarketNews(limit = 10): Promise<NewsItem[]> {
  if (process.env.STOCK_DATA_MODE === "mock") return mockMarketNews(limit);
  const url = "https://feeds.finance.yahoo.com/rss/2.0/headline?region=US&lang=en-US&category=generalnews";
  try {
    const res = await fetch(url, { headers: YAHOO_HEADERS, next: { revalidate: 600 } });
    if (!res.ok) throw new Error(`Yahoo market news ${res.status}`);
    const xml = await res.text();
    const items = parseRss(xml);
    return items.slice(0, limit);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[yahoo] market news failed, using mock`, err);
    }
    return mockMarketNews(limit);
  }
}

function mockNews(input: string, limit: number): NewsItem[] {
  const seed = input.toUpperCase();
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
    link: `https://finance.yahoo.com/quote/${encodeURIComponent(seed)}`,
    publishedAt: now - i * 3600 * 1000,
    source: "샘플 뉴스",
    description: "샘플 뉴스 데이터입니다. 실제 환경에서는 Yahoo Finance RSS를 통해 최신 뉴스가 표시됩니다.",
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
