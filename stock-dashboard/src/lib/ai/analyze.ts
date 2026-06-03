import type { AnalysisReport, Candle, Quote } from "@/types/stock";
import { ema, rsi, macd } from "@/lib/stocks/indicators";
import type { Fundamentals } from "@/lib/stocks/fundamentals";
import type { NewsItem } from "@/lib/stocks/news";
import { computeVerdict, verdictToText, type Recommendation } from "@/lib/analysis/engine";
import { localLlmChat } from "./local-llm";

interface AnalyzeInput {
  quote: Quote;
  history: Candle[];
  fundamentals?: Fundamentals;
  news?: NewsItem[];
  /** 시장 분위기(시장 심리 점수 0~100) */
  marketScore?: number;
}

function mapVerdictRec(r: Recommendation): "buy" | "hold" | "sell" {
  if (r === "strong_buy" || r === "buy") return "buy";
  if (r === "reduce" || r === "sell") return "sell";
  return "hold";
}

const SYSTEM_PROMPT =
  "You are a careful equity research assistant. Synthesize technical indicators, fundamental metrics, AND recent news headlines together — do not rely on price/chart alone. Always respond in Korean using strict JSON matching the requested schema. Cite which factor (차트/재무/뉴스) drives each point. Do NOT provide direct buy/sell recommendations; describe scenarios and risks.";

export async function buildAnalysis(input: AnalyzeInput): Promise<AnalysisReport> {
  const { quote, history, fundamentals, news, marketScore } = input;
  const verdict = computeVerdict({ quote, candles: history, fundamentals, news, marketScore });
  try {
    // 로컬 LLM(Ollama 등)으로 종합 분석. 미실행/실패 시 지표 기반 mock 분석.
    const prompt = renderPrompt(
      quote,
      buildSeriesSummary(history),
      buildFundamentalsSummary(fundamentals),
      buildNewsSummary(news),
      verdictToText(verdict),
    );
    const text = await localLlmChat(SYSTEM_PROMPT, prompt, { json: true, timeoutMs: 120_000 });
    const parsed = parseModelJson(text);
    if (!parsed.summary && (!parsed.bullish || parsed.bullish.length === 0)) {
      throw new Error("local LLM: empty analysis");
    }
    return {
      ticker: quote.ticker,
      generatedAt: Date.now(),
      summary: parsed.summary ?? "",
      bullish: parsed.bullish ?? [],
      bearish: parsed.bearish ?? [],
      outlook: parsed.outlook ?? "",
      riskLevel: parsed.riskLevel ?? "medium",
      recommendation: parsed.recommendation ?? mapVerdictRec(verdict.recommendation),
      fromCache: false,
      source: "local",
    };
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[ai] local LLM analysis failed, falling back to mock", err);
    }
    return mockAnalysis(input);
  }
}

function buildSeriesSummary(history: Candle[]) {
  if (history.length === 0) return "no data";
  const last = history[history.length - 1];
  const first = history[0];
  const total = ((last.close - first.close) / first.close) * 100;
  const e20 = ema(history, 20).at(-1)?.value ?? last.close;
  const e60 = ema(history, 60).at(-1)?.value ?? last.close;
  const e120 = ema(history, 120).at(-1)?.value ?? last.close;
  const rsiLast = rsi(history, 14).at(-1)?.value ?? 50;
  const macdLast = macd(history).at(-1);
  const high = Math.max(...history.map((c) => c.high));
  const low = Math.min(...history.map((c) => c.low));
  return [
    `lookback days: ${history.length}`,
    `period return: ${total.toFixed(2)}%`,
    `last close: ${last.close}`,
    `period high: ${high}, low: ${low}`,
    `EMA20: ${e20.toFixed(2)}, EMA60: ${e60.toFixed(2)}, EMA120: ${e120.toFixed(2)}`,
    `RSI14: ${rsiLast.toFixed(1)}`,
    macdLast
      ? `MACD: ${macdLast.macd.toFixed(3)}, signal: ${macdLast.signal.toFixed(3)}, hist: ${macdLast.histogram.toFixed(3)}`
      : "MACD: n/a",
  ].join("\n");
}

function pct(v?: number, digits = 2): string {
  return v == null || !isFinite(v) ? "n/a" : `${(v * 100).toFixed(digits)}%`;
}
function num(v?: number, digits = 2): string {
  return v == null || !isFinite(v) ? "n/a" : v.toFixed(digits);
}

function buildFundamentalsSummary(f?: Fundamentals): string {
  if (!f) return "no fundamentals data";
  return [
    `PER(TTM): ${num(f.peRatio)}, Forward PER: ${num(f.forwardPe)}, PBR: ${num(f.pbRatio)}`,
    `EPS: ${num(f.eps)}, ROE: ${pct(f.roe)}, 순이익률: ${pct(f.profitMargin)}`,
    `매출성장률: ${pct(f.revenueGrowth)}, 이익성장률: ${pct(f.earningsGrowth)}`,
    `배당수익률: ${pct(f.dividendYield)}, 베타: ${num(f.beta)}, 부채비율(D/E): ${num(f.debtToEquity, 1)}`,
    `52주 고점: ${num(f.fiftyTwoWeekHigh)}, 52주 저점: ${num(f.fiftyTwoWeekLow)}`,
    f.source === "mock" ? "(주의: 펀더멘털은 샘플 데이터)" : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildNewsSummary(news?: NewsItem[]): string {
  if (!news || news.length === 0) return "no recent news";
  return news
    .slice(0, 8)
    .map((n, i) => {
      const when = new Date(n.publishedAt).toLocaleDateString("ko-KR");
      return `${i + 1}. [${when}] ${n.title}${n.source ? ` (${n.source})` : ""}`;
    })
    .join("\n");
}

function renderPrompt(
  quote: Quote,
  series: string,
  fundamentals: string,
  news: string,
  verdict: string,
): string {
  return `Analyze the following equity by SYNTHESIZING three data domains together:
technical chart indicators, fundamental financials, and recent news.
Each bullish/bearish point should reference its source as a tag: [차트], [재무], or [뉴스].
Reply with strict JSON only.

Schema:
{
  "summary": "차트·재무·뉴스를 종합한 2~4문장 요약",
  "bullish": ["[차트/재무/뉴스] 근거 불릿 3~4개"],
  "bearish": ["[차트/재무/뉴스] 근거 불릿 3~4개"],
  "outlook": "단기/중기 시나리오 (4~6문장, 세 영역을 모두 언급)",
  "riskLevel": "low" | "medium" | "high",
  "recommendation": "buy" | "hold" | "sell"  // 참고용 신호: bullish > bearish이고 추세·재무 모두 우호적이면 buy, 명백히 약세·고평가·악재 우위면 sell, 그 외는 hold
}

== 종목 정보 ==
Ticker: ${quote.ticker} (${quote.market})
Name: ${quote.name}
Currency: ${quote.currency}
Current price: ${quote.price}
Daily change: ${quote.changePercent.toFixed(2)}%
Volume: ${quote.volume}

== 차트/기술지표 ==
${series}

== 펀더멘털/재무 ==
${fundamentals}

== 최근 뉴스 헤드라인 ==
${news}

== 다요인 종합 스코어 (규칙 엔진이 계산한 7축 점수) ==
${verdict}

위 종합 스코어를 참고하되 맹신하지 말고, 차트·재무·뉴스·시장분위기가 서로 상충하면 그 점을 명확히 짚으세요.
recommendation은 종합점수·각 축의 균형을 반영해 정하세요.
뉴스 헤드라인이 가격/재무에 주는 함의를 해석에 반영하세요.
불확실성은 솔직히 기술하세요. 한국어로, JSON만 출력.`;
}

function parseModelJson(text: string): Partial<AnalysisReport> {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return {};
  try {
    return JSON.parse(match[0]) as Partial<AnalysisReport>;
  } catch {
    return {};
  }
}


function mockAnalysis({ quote, history, fundamentals, news, marketScore }: AnalyzeInput): AnalysisReport {
  const e20 = ema(history, 20).at(-1)?.value ?? quote.price;
  const e60 = ema(history, 60).at(-1)?.value ?? quote.price;
  const rsiLast = rsi(history, 14).at(-1)?.value ?? 50;
  const direction = quote.price >= e60 ? "상승" : "하락";
  const momentum = rsiLast >= 70 ? "과매수" : rsiLast <= 30 ? "과매도" : "중립";
  const risk: AnalysisReport["riskLevel"] =
    Math.abs(quote.changePercent) > 4
      ? "high"
      : Math.abs(quote.changePercent) > 1.5
        ? "medium"
        : "low";

  // 펀더멘털 종합
  const bullish: string[] = [
    `[차트] EMA20(${e20.toFixed(2)})이 EMA60(${e60.toFixed(2)}) ${e20 >= e60 ? "위" : "아래"}에서 형성, ${direction} 구조`,
  ];
  const bearish: string[] = [
    momentum === "과매수"
      ? "[차트] RSI 과매수 구간 진입으로 단기 조정 가능성"
      : "[차트] RSI 중립/약세 구간으로 모멘텀 제한적",
  ];

  if (fundamentals) {
    const f = fundamentals;
    if (f.roe != null && f.roe > 0.15) bullish.push(`[재무] ROE ${(f.roe * 100).toFixed(1)}%로 수익성 양호`);
    if (f.revenueGrowth != null && f.revenueGrowth > 0.1)
      bullish.push(`[재무] 매출성장률 ${(f.revenueGrowth * 100).toFixed(1)}%로 외형 성장`);
    if (f.peRatio != null && f.peRatio > 30)
      bearish.push(`[재무] PER ${f.peRatio.toFixed(1)}배로 밸류에이션 부담`);
    if (f.debtToEquity != null && f.debtToEquity > 100)
      bearish.push(`[재무] 부채비율(D/E) ${f.debtToEquity.toFixed(0)}로 재무 레버리지 높음`);
    if (f.dividendYield != null && f.dividendYield > 0.02)
      bullish.push(`[재무] 배당수익률 ${(f.dividendYield * 100).toFixed(2)}%로 인컴 매력`);
  }

  const newsCount = news?.length ?? 0;
  if (newsCount > 0) {
    bullish.push(`[뉴스] 최근 뉴스 ${newsCount}건 확인 — 첫 헤드라인: "${news![0].title.slice(0, 40)}"`);
    bearish.push("[뉴스] 헤드라인의 실제 논조/이벤트는 본문 확인 필요 (속보성 리스크)");
  } else {
    bearish.push("[뉴스] 최근 뉴스 데이터 부족 — 이벤트 리스크 점검 한계");
  }

  const fundLine = fundamentals
    ? `PER ${num(fundamentals.peRatio)}·ROE ${pct(fundamentals.roe)} 등 재무 지표와 `
    : "";

  return {
    ticker: quote.ticker,
    generatedAt: Date.now(),
    summary: `${quote.name}은(는) 중기 추세선(EMA60) 대비 ${direction} 흐름이며 RSI 기준 ${momentum} 구간입니다. ${fundLine}최근 뉴스 ${newsCount}건을 종합하면, 현재가 ${quote.price}(당일 ${quote.changePercent.toFixed(2)}%)는 차트·재무·뉴스 신호가 혼재된 국면입니다. (지표 기반 자동 분석 - 로컬 LLM 실행 시 종합 분석)`,
    bullish: bullish.slice(0, 4),
    bearish: bearish.slice(0, 4),
    outlook: `[차트] 단기적으로 EMA20을 지지선으로 ${direction} 추세 연장 여부가 관건이며, RSI ${rsiLast.toFixed(1)} 구간에서는 ${momentum === "과매수" ? "이익 실현 매물" : momentum === "과매도" ? "기술적 반등" : "방향성 대기"}을 염두에 둡니다. [재무] ${fundamentals ? `PER ${num(fundamentals.peRatio)}·매출성장 ${pct(fundamentals.revenueGrowth)} 등 밸류에이션과 성장성을 함께 점검해야 합니다.` : "펀더멘털 데이터 보완이 필요합니다."} [뉴스] 최근 ${newsCount}건의 헤드라인이 실적/규제/제품 이벤트를 시사할 수 있어 본문 확인이 권장됩니다. 세 영역의 신호가 일치할 때 추세 신뢰도가 높아집니다.`,
    riskLevel: risk,
    recommendation: mapVerdictRec(
      computeVerdict({ quote, candles: history, fundamentals, news, marketScore }).recommendation,
    ),
    fromCache: false,
    source: "mock",
  };
}

export function debugSummary(history: Candle[]): string {
  return buildSeriesSummary(history);
}
