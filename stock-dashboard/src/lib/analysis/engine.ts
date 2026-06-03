import type { Candle, Quote } from "@/types/stock";
import type { Fundamentals } from "@/lib/stocks/fundamentals";
import type { NewsItem } from "@/lib/stocks/news";
import {
  ema,
  rsi,
  macd,
  bollinger,
  atr,
  stochastic,
  obv,
  supportResistance,
} from "@/lib/stocks/indicators";

// 다요인 스코어링 엔진 — 전문 트레이더가 보는 축들을 0~100으로 환산해 가중 종합.
// 점수는 데이터(규칙)로 확정하고, 해석/서술은 상위(LLM)에서 담당.

export type Lean = "good" | "bad" | "neutral";

export interface AxisResult {
  key: string;
  label: string;
  score: number; // 0~100 (50=중립)
  weight: number; // 가중치(합 100)
  lean: Lean;
  detail: string; // 근거(수치)
}

export type Recommendation = "strong_buy" | "buy" | "hold" | "reduce" | "sell";

export interface AnalysisVerdict {
  composite: number; // 0~100 종합 점수
  recommendation: Recommendation;
  recLabel: string;
  confidence: "high" | "medium" | "low";
  confidenceReason: string;
  axes: AxisResult[];
  levels: { support?: number; resistance?: number; atrPct?: number };
}

interface EngineInput {
  quote: Quote;
  candles: Candle[];
  fundamentals?: Fundamentals;
  news?: NewsItem[];
  /** 해당 시장 심리 점수 0~100 (시장 분위기) */
  marketScore?: number;
}

const clamp = (v: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, v));
const leanOf = (score: number): Lean => (score >= 58 ? "good" : score <= 42 ? "bad" : "neutral");

export function computeVerdict(input: EngineInput): AnalysisVerdict {
  const { quote, candles, fundamentals, news, marketScore } = input;
  const price = quote.price;
  const axes: AxisResult[] = [];

  // ── ① 추세 (이동평균 정배열) ──
  const e20 = ema(candles, 20).at(-1)?.value;
  const e60 = ema(candles, 60).at(-1)?.value;
  const e120 = ema(candles, 120).at(-1)?.value;
  {
    let s = 50;
    const parts: string[] = [];
    if (e60 != null) {
      if (price >= e60) {
        s += 15;
        parts.push("60일선 위");
      } else {
        s -= 15;
        parts.push("60일선 아래");
      }
    }
    if (e20 != null && e60 != null) {
      if (e20 >= e60) {
        s += 12;
        parts.push("단기>중기(정배열)");
      } else {
        s -= 12;
        parts.push("단기<중기(역배열)");
      }
    }
    if (e60 != null && e120 != null) {
      if (e60 >= e120) s += 8;
      else s -= 8;
    }
    axes.push({
      key: "trend",
      label: "추세",
      score: clamp(s),
      weight: 22,
      lean: leanOf(clamp(s)),
      detail: parts.join(" · ") || "데이터 부족",
    });
  }

  // ── ② 모멘텀 (RSI · MACD · 스토캐스틱) ──
  const rsiV = rsi(candles, 14).at(-1)?.value;
  const macdL = macd(candles).at(-1);
  const stoch = stochastic(candles).at(-1);
  {
    let s = 50;
    const parts: string[] = [];
    if (macdL) {
      if (macdL.histogram > 0) {
        s += 14;
        parts.push("MACD 양(+)");
      } else {
        s -= 14;
        parts.push("MACD 음(−)");
      }
    }
    if (rsiV != null) {
      if (rsiV >= 70) {
        s -= 6;
        parts.push(`RSI ${rsiV.toFixed(0)}(과열)`);
      } else if (rsiV >= 55) {
        s += 10;
        parts.push(`RSI ${rsiV.toFixed(0)}(상승세)`);
      } else if (rsiV <= 30) {
        s += 4;
        parts.push(`RSI ${rsiV.toFixed(0)}(과매도)`);
      } else if (rsiV < 45) {
        s -= 8;
        parts.push(`RSI ${rsiV.toFixed(0)}(약세)`);
      } else {
        parts.push(`RSI ${rsiV.toFixed(0)}`);
      }
    }
    if (stoch) {
      if (stoch.k >= 80) s -= 4;
      else if (stoch.k <= 20) s += 4;
      if (stoch.k >= stoch.d) s += 6;
      else s -= 6;
    }
    axes.push({
      key: "momentum",
      label: "모멘텀",
      score: clamp(s),
      weight: 18,
      lean: leanOf(clamp(s)),
      detail: parts.join(" · ") || "데이터 부족",
    });
  }

  // ── ③ 변동성/위치 (볼린저밴드) ──
  const boll = bollinger(candles).at(-1);
  const atrV = atr(candles).at(-1)?.value;
  const atrPct = atrV != null && price > 0 ? (atrV / price) * 100 : undefined;
  {
    let s = 50;
    let detail = "데이터 부족";
    if (boll) {
      // %B 높음=상단(과열), 낮음=하단(낙폭과대)
      s = clamp(50 + (0.5 - boll.percentB) * 60);
      const pos =
        boll.percentB >= 1
          ? "밴드 상단 돌파(과열)"
          : boll.percentB <= 0
            ? "밴드 하단 이탈(낙폭과대)"
            : `밴드 내 ${(boll.percentB * 100).toFixed(0)}% 위치`;
      detail = `${pos}${atrPct != null ? ` · 변동성 ${atrPct.toFixed(1)}%` : ""}`;
    }
    axes.push({
      key: "volatility",
      label: "변동성/위치",
      score: s,
      weight: 10,
      lean: leanOf(s),
      detail,
    });
  }

  // ── ④ 거래량 (급증 + OBV 추세) ──
  {
    let s = 50;
    const parts: string[] = [];
    const vols = candles.map((c) => c.volume).filter((v) => v > 0);
    if (vols.length >= 6) {
      const recent = vols[vols.length - 1];
      const base = vols.slice(-21, -1);
      const avg = base.reduce((a, b) => a + b, 0) / (base.length || 1);
      const ratio = avg > 0 ? recent / avg : 1;
      const up = quote.changePercent >= 0;
      if (ratio >= 1.8) {
        s += up ? 16 : -16;
        parts.push(`거래량 ${ratio.toFixed(1)}배(${up ? "상승+대량" : "하락+대량"})`);
      } else if (ratio <= 0.6) {
        parts.push("거래 한산");
      } else {
        parts.push("거래량 보통");
      }
    }
    const obvSeries = obv(candles);
    if (obvSeries.length >= 21) {
      const o = obvSeries.at(-1)!.value;
      const oPrev = obvSeries.at(-21)!.value;
      if (o > oPrev) {
        s += 8;
        parts.push("OBV 상승(매집)");
      } else if (o < oPrev) {
        s -= 8;
        parts.push("OBV 하락(분산)");
      }
    }
    axes.push({
      key: "volume",
      label: "거래량/수급",
      score: clamp(s),
      weight: 12,
      lean: leanOf(clamp(s)),
      detail: parts.join(" · ") || "데이터 부족",
    });
  }

  // ── ⑤ 밸류에이션 (PER/PBR — 실데이터만) ──
  {
    let s = 50;
    let detail = "PER/PBR 데이터 없음";
    let valid = false;
    if (fundamentals && fundamentals.source !== "mock") {
      const per = fundamentals.peRatio;
      const pbr = fundamentals.pbRatio;
      if (per != null || pbr != null) {
        valid = true;
        if (per != null) {
          if (per > 0 && per < 10) s += 20;
          else if (per < 20) s += 5;
          else if (per <= 35) s -= 5;
          else s -= 20;
        }
        if (pbr != null) {
          if (pbr < 1) s += 10;
          else if (pbr > 5) s -= 10;
        }
        detail = `PER ${per?.toFixed(1) ?? "—"} · PBR ${pbr?.toFixed(1) ?? "—"}`;
      }
    }
    axes.push({
      key: "valuation",
      label: "밸류에이션",
      score: clamp(s),
      weight: valid ? 16 : 0, // 데이터 없으면 가중치 0 (종합서 제외)
      lean: valid ? leanOf(clamp(s)) : "neutral",
      detail,
    });
  }

  // ── ⑥ 시장 분위기 (시장 심리 점수) ──
  {
    const valid = marketScore != null;
    const s = valid ? clamp(marketScore!) : 50;
    axes.push({
      key: "market",
      label: "시장 분위기",
      score: s,
      weight: valid ? 14 : 0,
      lean: valid ? leanOf(s) : "neutral",
      detail: valid
        ? `시장 심리 ${s.toFixed(0)}점 (${s >= 60 ? "낙관" : s <= 40 ? "불안" : "중립"})`
        : "시장 심리 데이터 없음",
    });
  }

  // ── ⑦ 뉴스/관심도 (LLM 감성분석은 추후) ──
  {
    const n = news?.length ?? 0;
    const s = n >= 6 ? 55 : n >= 1 ? 52 : 50;
    axes.push({
      key: "news",
      label: "뉴스/관심도",
      score: s,
      weight: 8,
      lean: "neutral",
      detail: n > 0 ? `최근 뉴스 ${n}건 (본문 확인 권장)` : "뉴스 데이터 부족",
    });
  }

  // ── 가중 종합 ──
  const totalW = axes.reduce((a, x) => a + x.weight, 0) || 1;
  const composite = axes.reduce((a, x) => a + x.score * x.weight, 0) / totalW;

  const recommendation: Recommendation =
    composite >= 68
      ? "strong_buy"
      : composite >= 58
        ? "buy"
        : composite >= 45
          ? "hold"
          : composite >= 35
            ? "reduce"
            : "sell";
  const recLabel = {
    strong_buy: "적극 매수 관점",
    buy: "매수 관점",
    hold: "관망 (중립)",
    reduce: "비중축소 관점",
    sell: "매도 관점",
  }[recommendation];

  // 신뢰도: 데이터 충실도
  const reasons: string[] = [];
  let conf = 0;
  if (candles.length >= 120) conf += 1;
  else reasons.push("주가 데이터 짧음");
  if (fundamentals && fundamentals.source !== "mock") conf += 1;
  else reasons.push("펀더멘털 미반영");
  if (marketScore != null) conf += 1;
  else reasons.push("시장 분위기 미반영");
  const confidence = conf >= 3 ? "high" : conf >= 2 ? "medium" : "low";

  const sr = supportResistance(candles);

  return {
    composite: Number(composite.toFixed(1)),
    recommendation,
    recLabel,
    confidence,
    confidenceReason: reasons.length ? reasons.join(", ") : "주요 데이터 충실",
    axes: axes.filter((a) => a.weight > 0),
    levels: { support: sr?.support, resistance: sr?.resistance, atrPct },
  };
}

/** LLM 프롬프트용 요약 텍스트 */
export function verdictToText(v: AnalysisVerdict): string {
  const lines = [
    `종합점수: ${v.composite}/100 → ${v.recLabel} (신뢰도 ${v.confidence})`,
    ...v.axes.map((a) => `- ${a.label}: ${a.score.toFixed(0)}점 [${a.detail}]`),
  ];
  if (v.levels.support != null)
    lines.push(`참고 지지/저항: ${v.levels.support} / ${v.levels.resistance}`);
  return lines.join("\n");
}
