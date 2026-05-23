import type { AnalysisReport, Candle, Quote } from "@/types/stock";
import { ema, rsi, macd } from "@/lib/stocks/indicators";

interface AnalyzeInput {
  quote: Quote;
  history: Candle[];
}

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

export async function buildAnalysis({ quote, history }: AnalyzeInput): Promise<AnalysisReport> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return mockAnalysis({ quote, history });
  }
  try {
    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic({ apiKey });
    const summary = buildSeriesSummary(history);
    const prompt = renderPrompt(quote, summary);
    const message = await client.messages.create({
      model: MODEL,
      max_tokens: 1200,
      system:
        "You are a careful equity research assistant. Always respond in Korean using strict JSON matching the requested schema. Do NOT provide direct buy/sell recommendations; describe scenarios and risks.",
      messages: [{ role: "user", content: prompt }],
    });
    const text = message.content
      .filter((c): c is Extract<typeof c, { type: "text" }> => c.type === "text")
      .map((c) => c.text)
      .join("");
    const parsed = parseModelJson(text);
    return {
      ticker: quote.ticker,
      generatedAt: Date.now(),
      summary: parsed.summary ?? "",
      bullish: parsed.bullish ?? [],
      bearish: parsed.bearish ?? [],
      outlook: parsed.outlook ?? "",
      riskLevel: parsed.riskLevel ?? "medium",
      fromCache: false,
      source: "claude",
    };
  } catch (err) {
    console.warn("[ai] claude failed, falling back to mock", err);
    return mockAnalysis({ quote, history });
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

function renderPrompt(quote: Quote, series: string): string {
  return `Analyze the following equity using the supplied data only. Reply with strict JSON.

Schema:
{
  "summary": "2~3문장 요약",
  "bullish": ["불릿 1", "불릿 2", "불릿 3"],
  "bearish": ["불릿 1", "불릿 2", "불릿 3"],
  "outlook": "단기/중기 시나리오 (3~5문장)",
  "riskLevel": "low" | "medium" | "high"
}

Ticker: ${quote.ticker} (${quote.market})
Name: ${quote.name}
Currency: ${quote.currency}
Current price: ${quote.price}
Daily change: ${quote.changePercent.toFixed(2)}%
Volume: ${quote.volume}

Series summary:
${series}

Be candid about uncertainty. Use Korean. JSON only.`;
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

function mockAnalysis({ quote, history }: AnalyzeInput): AnalysisReport {
  const series = buildSeriesSummary(history);
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
  return {
    ticker: quote.ticker,
    generatedAt: Date.now(),
    summary: `${quote.name}은(는) 중기 추세선(EMA60) 대비 ${direction} 흐름을 보이며, RSI 기준 ${momentum} 구간에 위치합니다. 현재가는 ${quote.price}이며 당일 ${quote.changePercent.toFixed(2)}% 변동했습니다. (예시 분석 - ANTHROPIC_API_KEY 설정 시 실제 분석)`,
    bullish: [
      `EMA20(${e20.toFixed(2)})이 EMA60(${e60.toFixed(2)}) ${e20 >= e60 ? "위" : "아래"}에서 형성`,
      `최근 ${history.length}일 데이터 기반 변동성 관측 가능`,
      "거래량 흐름과 기술적 패턴 추가 분석 필요",
    ],
    bearish: [
      momentum === "과매수" ? "RSI 과매수 구간 진입으로 단기 조정 가능성" : "RSI 중립 구간으로 모멘텀 약함",
      "거시 환경/금리 변동에 따른 외부 리스크",
      "차트 단독 판단의 한계 - 펀더멘털 점검 필요",
    ],
    outlook: `단기적으로는 EMA20 라인을 지지선으로 활용할 수 있으며, ${direction} 추세가 유지될 경우 기존 흐름 연장이 가능합니다. 중기적으로는 거시 환경, 실적 발표, 업종 비교 등 추가 데이터로 보완이 필요합니다. RSI ${rsiLast.toFixed(1)} 구간에서는 ${momentum === "과매수" ? "이익 실현 매물 출현 가능성" : momentum === "과매도" ? "기술적 반등 시도 가능성" : "방향성 형성 대기"}을 염두에 두시기 바랍니다.`,
    riskLevel: risk,
    fromCache: false,
    source: "mock",
  };
}

export function debugSummary(history: Candle[]): string {
  return buildSeriesSummary(history);
}
