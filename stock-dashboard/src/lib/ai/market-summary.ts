import type { NewsItem } from "@/lib/stocks/news";
import type { MarketIndex } from "@/lib/stocks/markets";
import { localLlmChat } from "./local-llm";

export interface MarketSummary {
  generatedAt: number;
  headline: string; // 한 줄 핵심
  bullets: string[]; // 2~4줄 요약
  themes: string[]; // 핵심 테마 태그
  sentiment: "긍정" | "중립" | "부정";
  source: "local" | "heuristic";
}

const SYSTEM_PROMPT = `당신은 한국 개인 투자자를 위한 금융 시장 애널리스트입니다.
주어진 지수/환율 데이터와 최근 뉴스 헤드라인만을 근거로 "오늘의 시장 요약"을 작성합니다.
규칙:
- 한국어로 간결하게.
- 매수/매도 등 직접적 투자 권유 금지. 사실과 시나리오·리스크 위주로 기술.
- 헤드라인이 시사하는 테마(예: 반도체, AI, 금리, 환율, 실적)를 종합.
- 반드시 아래 JSON 스키마로만 응답. JSON 외 텍스트 금지.
{
  "headline": "오늘 시장을 한 문장으로 요약",
  "bullets": ["핵심 요약 2~4개 (각 1문장)"],
  "themes": ["핵심 테마 키워드 3~6개"],
  "sentiment": "긍정" | "중립" | "부정"
}`;

function renderInput(news: NewsItem[], indices: MarketIndex[]): string {
  const idxLines = indices
    .map((i) => `- ${i.name}: ${i.price} (${i.changePercent > 0 ? "+" : ""}${i.changePercent.toFixed(2)}%)`)
    .join("\n");
  const newsLines = news
    .slice(0, 12)
    .map((n, i) => `${i + 1}. ${n.title}${n.source ? ` (${n.source})` : ""}`)
    .join("\n");
  return `== 지수/환율 ==\n${idxLines || "데이터 없음"}\n\n== 최근 뉴스 헤드라인 ==\n${newsLines || "데이터 없음"}\n\n위 데이터로 오늘의 시장 요약 JSON을 작성하세요.`;
}

function parseJson(text: string): Partial<MarketSummary> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    return JSON.parse(match[0]) as Partial<MarketSummary>;
  } catch {
    return {};
  }
}

interface BuildInput {
  news: NewsItem[];
  indices: MarketIndex[];
}

export async function buildMarketSummary({ news, indices }: BuildInput): Promise<MarketSummary> {
  try {
    // 로컬 LLM(Ollama 등)으로 종합 요약. 미실행/실패 시 휴리스틱 폴백.
    const text = await localLlmChat(SYSTEM_PROMPT, renderInput(news, indices), {
      json: true,
      timeoutMs: 90_000,
    });
    const parsed = parseJson(text);
    const sentiment =
      parsed.sentiment === "긍정" || parsed.sentiment === "부정" ? parsed.sentiment : "중립";
    return {
      generatedAt: Date.now(),
      headline: parsed.headline?.trim() || heuristicHeadline(indices),
      bullets: Array.isArray(parsed.bullets) && parsed.bullets.length > 0
        ? parsed.bullets.slice(0, 4)
        : heuristicBullets(news, indices),
      themes: Array.isArray(parsed.themes) && parsed.themes.length > 0
        ? parsed.themes.slice(0, 6)
        : extractThemes(news),
      sentiment,
      source: "local",
    };
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[ai] market summary (local LLM) failed, using heuristic", err);
    }
    return heuristicSummary(news, indices);
  }
}

// ---- 휴리스틱 폴백 (API 키 없거나 실패 시) ----

const THEME_KEYWORDS: Record<string, string[]> = {
  반도체: ["반도체", "하이닉스", "HBM", "메모리", "파운드리", "삼전닉스"],
  AI: ["AI", "인공지능", "엔비디아", "클로드", "앤트로픽", "챗GPT"],
  "2차전지": ["2차전지", "배터리", "에코프로", "LG에너지", "양극재"],
  금리: ["금리", "Fed", "연준", "FOMC", "기준금리"],
  환율: ["환율", "원/달러", "달러", "외환"],
  실적: ["실적", "어닝", "영업이익", "분기"],
  배당: ["배당", "자사주", "주주환원"],
  코스피: ["코스피", "코스닥", "지수", "사상 최고"],
};

function extractThemes(news: NewsItem[]): string[] {
  const counts = new Map<string, number>();
  const text = news.map((n) => n.title).join(" ");
  for (const [theme, kws] of Object.entries(THEME_KEYWORDS)) {
    const hits = kws.reduce((a, kw) => a + (text.includes(kw) ? 1 : 0), 0);
    if (hits > 0) counts.set(theme, hits);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t]) => t);
}

function avgChange(indices: MarketIndex[]): number {
  const eq = indices.filter((i) => i.region !== "FX");
  if (eq.length === 0) return 0;
  return eq.reduce((a, i) => a + i.changePercent, 0) / eq.length;
}

function heuristicHeadline(indices: MarketIndex[]): string {
  const avg = avgChange(indices);
  const dir = avg > 0.3 ? "상승" : avg < -0.3 ? "하락" : "혼조";
  const kr = indices.find((i) => i.name === "KOSPI");
  const us = indices.find((i) => i.name.includes("S&P") || i.name.includes("Nasdaq"));
  const parts = [
    kr ? `KOSPI ${kr.changePercent > 0 ? "+" : ""}${kr.changePercent.toFixed(2)}%` : null,
    us ? `${us.name} ${us.changePercent > 0 ? "+" : ""}${us.changePercent.toFixed(2)}%` : null,
  ].filter(Boolean);
  return `시장 ${dir} 흐름${parts.length ? ` (${parts.join(", ")})` : ""}`;
}

function heuristicBullets(news: NewsItem[], indices: MarketIndex[]): string[] {
  const themes = extractThemes(news);
  const bullets: string[] = [];
  bullets.push(heuristicHeadline(indices));
  if (themes.length > 0) bullets.push(`주요 테마: ${themes.join(", ")} 관련 기사가 다수입니다.`);
  if (news[0]) bullets.push(`핵심 헤드라인: "${news[0].title.slice(0, 50)}"`);
  bullets.push("개별 기사 본문과 지표를 함께 확인하세요. (로컬 LLM 실행 시 종합 요약)");
  return bullets.slice(0, 4);
}

function heuristicSummary(news: NewsItem[], indices: MarketIndex[]): MarketSummary {
  const avg = avgChange(indices);
  const sentiment: MarketSummary["sentiment"] = avg > 0.3 ? "긍정" : avg < -0.3 ? "부정" : "중립";
  return {
    generatedAt: Date.now(),
    headline: heuristicHeadline(indices),
    bullets: heuristicBullets(news, indices),
    themes: extractThemes(news),
    sentiment,
    source: "heuristic",
  };
}
