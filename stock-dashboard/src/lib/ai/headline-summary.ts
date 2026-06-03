import { localLlmChat } from "./local-llm";
import type { NewsItem } from "@/lib/stocks/news";

// 뉴스 헤드라인 한 줄 요약 (로컬 LLM, 실패 시 테마 기반 휴리스틱)

export interface HeadlineSummary {
  text: string;
  source: "local" | "auto";
}

const THEME_KEYWORDS: Record<string, string[]> = {
  반도체: ["반도체", "하이닉스", "HBM", "메모리", "파운드리", "삼전닉스", "엔비디아"],
  AI: ["AI", "인공지능", "클로드", "앤트로픽", "챗GPT", "데이터센터"],
  "2차전지": ["2차전지", "배터리", "에코프로", "LG에너지", "양극재"],
  금리: ["금리", "Fed", "연준", "FOMC", "기준금리", "국채"],
  환율: ["환율", "원/달러", "달러", "외환"],
  실적: ["실적", "어닝", "영업이익", "분기"],
  배당: ["배당", "자사주", "주주환원"],
  지수: ["코스피", "코스닥", "나스닥", "S&P", "사상 최고", "지수"],
  정책: ["규제", "정책", "정부", "법", "세금"],
};

function heuristic(items: NewsItem[], label: string): string {
  const text = items.map((n) => n.title).join(" ");
  const counts = Object.entries(THEME_KEYWORDS)
    .map(([t, kws]) => [t, kws.reduce((a, k) => a + (text.includes(k) ? 1 : 0), 0)] as const)
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([t]) => t);
  if (counts.length === 0) return `최근 ${label} 뉴스 ${items.length}건을 확인하세요.`;
  return `오늘 ${label} 뉴스는 ${counts.join(" · ")} 이슈가 중심이에요.`;
}

// 동일 헤드라인 재요약 방지용 간단 캐시 (10분)
const cache = new Map<string, { value: HeadlineSummary; expires: number }>();
const TTL = 10 * 60_000;

export async function summarizeHeadlines(items: NewsItem[], label = "시장"): Promise<HeadlineSummary> {
  if (items.length === 0) return { text: "", source: "auto" };
  const key = label + "|" + items.slice(0, 8).map((n) => n.title).join("|");
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  const headlines = items
    .slice(0, 8)
    .map((n, i) => `${i + 1}. ${n.title}`)
    .join("\n");

  let result: HeadlineSummary;
  try {
    const sys =
      "너는 금융 뉴스 요약가야. 주어진 헤드라인들을 한국어 한 문장(40~70자)으로 요약해. 투자 권유나 단정적 전망은 금지하고 사실 위주로. 문장 하나만 출력해.";
    const text = await localLlmChat(sys, `${label} 뉴스 헤드라인:\n${headlines}\n\n한 문장 요약:`, {
      json: false,
      timeoutMs: 60_000,
      temperature: 0.3,
    });
    const clean = text.replace(/^["'\s]+|["'\s]+$/g, "").split("\n")[0].trim().slice(0, 120);
    result = clean ? { text: clean, source: "local" } : { text: heuristic(items, label), source: "auto" };
  } catch {
    result = { text: heuristic(items, label), source: "auto" };
  }
  cache.set(key, { value: result, expires: Date.now() + TTL });
  return result;
}
