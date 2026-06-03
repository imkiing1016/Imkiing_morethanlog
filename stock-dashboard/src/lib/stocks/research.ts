import { normalizeInput } from "./normalize";

// 애널리스트(증권사) 리포트 - 네이버 금융 리서치 (국내 종목)
// 응답: { result: [{ title, brokerName, writeDate, readCount, previewContent, researchId, itemCode }] }

export interface ResearchReport {
  title: string;
  broker: string;
  date: string; // "2026-05-27"
  targetPrice?: number; // 추출된 목표주가(원)
  readCount?: number;
  preview: string;
  link: string;
}

export interface ResearchSummary {
  reports: ResearchReport[];
  avgTargetPrice?: number; // 최근 리포트 목표주가 평균
  targetCount: number; // 목표주가가 있는 리포트 수
  source: "naver" | "mock";
}

const NAVER_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
  Referer: "https://m.stock.naver.com/",
};

function clean(text: string): string {
  return text
    .replace(/<[^>]+>/g, "")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .trim();
}

/** "목표주가를 55만원", "목표주가 330,000원", "목표가 40만원" 등에서 목표주가(원) 추출 */
function extractTargetPrice(text: string): number | undefined {
  const m = text.match(/목표(?:주가|가)[^0-9]{0,8}([0-9][0-9,]*)\s*(만)?\s*원/);
  if (!m) return undefined;
  const num = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(num)) return undefined;
  return m[2] ? num * 10000 : num;
}

interface NaverResearchItem {
  title?: string;
  brokerName?: string;
  writeDate?: string;
  readCount?: string | number;
  previewContent?: string;
  researchId?: number | string;
  itemCode?: string;
}

interface NaverResearchBody {
  result?: NaverResearchItem[];
}

export async function getResearchReports(input: string, limit = 8): Promise<ResearchSummary> {
  const { market, symbol } = normalizeInput(input);
  // 해외 종목은 네이버 국내 리서치 대상이 아님
  if (market !== "KR") return { reports: [], targetCount: 0, source: "mock" };
  const code = symbol.replace(/\.(KS|KQ)$/i, "");
  if (process.env.STOCK_DATA_MODE === "mock") return mockResearch(code, limit);

  try {
    const url = `https://m.stock.naver.com/front-api/research/list?itemCode=${encodeURIComponent(
      code,
    )}&pageSize=${limit}&page=1`;
    const res = await fetch(url, { headers: NAVER_HEADERS, next: { revalidate: 1800 } });
    if (!res.ok) throw new Error(`Naver research ${res.status}`);
    const json = (await res.json()) as NaverResearchBody;
    const items = json.result ?? [];
    if (items.length === 0) throw new Error("research: empty");

    const reports: ResearchReport[] = items.slice(0, limit).map((it) => {
      const title = clean(it.title ?? "");
      const preview = clean(it.previewContent ?? "");
      const target = extractTargetPrice(`${title} ${preview}`);
      return {
        title,
        broker: it.brokerName ?? "",
        date: it.writeDate ?? "",
        targetPrice: target,
        readCount: it.readCount != null ? Number(String(it.readCount).replace(/,/g, "")) : undefined,
        preview,
        link: `https://m.stock.naver.com/domestic/stock/${code}/research`,
      };
    });

    return summarize(reports, "naver");
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[naver] research ${code} failed, using mock`, err);
    }
    return mockResearch(code, limit);
  }
}

function summarize(reports: ResearchReport[], source: "naver" | "mock"): ResearchSummary {
  const targets = reports.map((r) => r.targetPrice).filter((v): v is number => v != null);
  const avg = targets.length > 0 ? Math.round(targets.reduce((a, b) => a + b, 0) / targets.length) : undefined;
  return { reports, avgTargetPrice: avg, targetCount: targets.length, source };
}

function mockResearch(code: string, limit: number): ResearchSummary {
  const now = new Date();
  const brokers = ["미래에셋증권", "신한투자증권", "키움증권", "한국투자증권", "삼성증권", "NH투자증권"];
  const reports: ResearchReport[] = Array.from({ length: Math.min(limit, 5) }, (_, i) => {
    const d = new Date(now.getTime() - i * 4 * 86400000);
    return {
      title: `${code} 실적 및 목표주가 점검 (예시)`,
      broker: brokers[i % brokers.length],
      date: d.toISOString().slice(0, 10),
      targetPrice: undefined,
      preview: "샘플 리서치 데이터입니다. 실제 환경에서는 네이버 금융 증권사 리포트가 표시됩니다.",
      link: `https://m.stock.naver.com/domestic/stock/${code}/research`,
    };
  });
  return { reports, targetCount: 0, source: "mock" };
}
