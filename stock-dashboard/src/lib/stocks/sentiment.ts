import type { Market, MarketSentiment, SentimentComponent } from "@/types/stock";
import { getHistory, getQuote } from "./provider";
import { ema, rsi } from "./indicators";

const KR_INDICES = ["^KS11", "^KQ11"];
const US_INDICES = ["^GSPC", "^IXIC", "^DJI"];
const VIX = "^VIX";

interface RawSentimentInput {
  market: Market;
  indices: number[];
  vix?: number;
  trendScore: number;
  momentumScore: number;
}

function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}

function scoreLabel(score: number): string {
  if (score >= 75) return "극단적 탐욕";
  if (score >= 60) return "탐욕";
  if (score >= 45) return "중립";
  if (score >= 30) return "공포";
  return "극단적 공포";
}

async function indexChange(symbol: string): Promise<number> {
  try {
    const q = await getQuote(symbol);
    return q.changePercent;
  } catch {
    return 0;
  }
}

async function indexTrend(symbol: string): Promise<{ trend: number; momentum: number }> {
  try {
    const history = await getHistory(symbol, "3mo");
    if (history.length < 60) return { trend: 0, momentum: 0 };
    const e20 = ema(history, 20);
    const e60 = ema(history, 60);
    const lastE20 = e20[e20.length - 1]?.value ?? 0;
    const lastE60 = e60[e60.length - 1]?.value ?? 0;
    const trend = lastE60 ? ((lastE20 - lastE60) / lastE60) * 100 : 0;
    const r = rsi(history, 14);
    const momentum = r[r.length - 1]?.value ?? 50;
    return { trend, momentum };
  } catch {
    return { trend: 0, momentum: 50 };
  }
}

const sentimentCache = new Map<Market, { value: MarketSentiment; expires: number }>();
const SENTIMENT_TTL = 3 * 60_000;

export async function getMarketSentiment(market: Market): Promise<MarketSentiment> {
  const cached = sentimentCache.get(market);
  if (cached && cached.expires > Date.now()) return cached.value;
  const value = await computeMarketSentiment(market);
  sentimentCache.set(market, { value, expires: Date.now() + SENTIMENT_TTL });
  return value;
}

async function computeMarketSentiment(market: Market): Promise<MarketSentiment> {
  const symbols = market === "KR" ? KR_INDICES : US_INDICES;
  const [changes, trendData, vixQuote] = await Promise.all([
    Promise.all(symbols.map(indexChange)),
    Promise.all(symbols.map(indexTrend)),
    market === "US"
      ? getQuote(VIX).then((q) => q.price).catch(() => undefined)
      : Promise.resolve<number | undefined>(undefined),
  ]);

  const avgChange = changes.reduce((s, v) => s + v, 0) / Math.max(1, changes.length);
  const avgTrend = trendData.reduce((s, t) => s + t.trend, 0) / Math.max(1, trendData.length);
  const avgMomentum =
    trendData.reduce((s, t) => s + t.momentum, 0) / Math.max(1, trendData.length);

  return buildSentiment({
    market,
    indices: changes,
    vix: vixQuote,
    trendScore: avgTrend,
    momentumScore: avgMomentum,
  }, avgChange);
}

function buildSentiment(input: RawSentimentInput, avgChange: number): MarketSentiment {
  const components: SentimentComponent[] = [];

  const dayScore = clamp(50 + avgChange * 12, 0, 100);
  components.push({
    key: "daily",
    label: "당일 등락",
    value: dayScore,
    weight: 0.25,
    description: `지수 평균 ${avgChange.toFixed(2)}%`,
  });

  const trendScore = clamp(50 + input.trendScore * 6, 0, 100);
  components.push({
    key: "trend",
    label: "추세 (EMA20 vs EMA60)",
    value: trendScore,
    weight: 0.3,
    description: `${input.trendScore >= 0 ? "+" : ""}${input.trendScore.toFixed(2)}%`,
  });

  const momentumScore = clamp(input.momentumScore, 0, 100);
  components.push({
    key: "momentum",
    label: "모멘텀 (RSI14)",
    value: momentumScore,
    weight: 0.25,
    description: `RSI ${input.momentumScore.toFixed(1)}`,
  });

  if (input.market === "US" && input.vix != null) {
    const vixScore = clamp(100 - (input.vix - 10) * 4, 0, 100);
    components.push({
      key: "vix",
      label: "VIX (공포지수)",
      value: vixScore,
      weight: 0.2,
      description: `VIX ${input.vix.toFixed(2)}`,
    });
  } else {
    const volProxy = clamp(100 - Math.abs(avgChange) * 15, 0, 100);
    components.push({
      key: "volatility",
      label: "변동성 안정도",
      value: volProxy,
      weight: 0.2,
      description: `평균 변동폭 ${Math.abs(avgChange).toFixed(2)}%`,
    });
  }

  const totalWeight = components.reduce((s, c) => s + c.weight, 0);
  const score = components.reduce((s, c) => s + c.value * c.weight, 0) / totalWeight;
  return {
    score: Number(score.toFixed(1)),
    label: scoreLabel(score),
    components,
    updatedAt: Date.now(),
  };
}
