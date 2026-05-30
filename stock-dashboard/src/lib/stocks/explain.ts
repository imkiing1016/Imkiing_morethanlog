import type { Candle, Quote } from "@/types/stock";
import type { NewsItem } from "./news";
import type { Fundamentals } from "./fundamentals";
import { ema, rsi } from "./indicators";

// 초보자를 위한 "쉬운 해설" 생성기 (데이터 기반 휴리스틱, 네트워크 불필요)
// 가격·거래량·추세·뉴스를 결과론적으로 연결해 평이한 한국어로 설명.

export type ExplainIcon = "summary" | "price" | "volume" | "trend" | "rsi" | "news" | "valuation" | "caution";
export type ExplainTone = "up" | "down" | "neutral";

export interface ExplainItem {
  icon: ExplainIcon;
  title: string;
  text: string;
  tone: ExplainTone;
}

interface ExplainInput {
  quote: Quote;
  candles: Candle[];
  news?: NewsItem[];
  fundamentals?: Fundamentals;
}

function pctText(p: number): string {
  return `${p > 0 ? "+" : ""}${p.toFixed(2)}%`;
}

export function explainStock({ quote, candles, news, fundamentals }: ExplainInput): ExplainItem[] {
  const items: ExplainItem[] = [];
  const isKr = quote.market === "KR";

  // --- 핵심 지표 미리 계산 ---
  const chg = quote.changePercent;
  const e20m = ema(candles, 20).at(-1)?.value;
  const e60m = ema(candles, 60).at(-1)?.value;
  const aboveTrend = e20m != null && e60m != null ? quote.price >= e60m : null;
  const rsiVal = rsi(candles, 14).at(-1)?.value;
  const volsAll = candles.map((c) => c.volume).filter((v) => v > 0);
  let volRatio: number | null = null;
  if (volsAll.length >= 6) {
    const recent = volsAll[volsAll.length - 1];
    const base = volsAll.slice(-21, -1);
    const avg = base.reduce((a, b) => a + b, 0) / (base.length || 1);
    volRatio = avg > 0 ? recent / avg : null;
  }

  // 0) 핵심 한 줄 (가장 먼저, 결과를 압축)
  const signals: string[] = [];
  if (volRatio != null && volRatio >= 2) signals.push("거래량 급증");
  else if (volRatio != null && volRatio <= 0.6) signals.push("거래 한산");
  if (rsiVal != null && rsiVal >= 70) signals.push("단기 과열(RSI 높음)");
  else if (rsiVal != null && rsiVal <= 30) signals.push("과매도(RSI 낮음)");
  if (aboveTrend === true) signals.push("상승 추세");
  else if (aboveTrend === false) signals.push("약세 추세");
  const keyDir = chg > 0.1 ? "상승" : chg < -0.1 ? "하락" : "보합";
  const keyTail =
    volRatio != null && volRatio >= 2
      ? "큰 이슈로 관심이 몰리는 모습이에요."
      : rsiVal != null && rsiVal >= 70
        ? "단기 과열 구간이라 조정 가능성도 함께 봐야 해요."
        : rsiVal != null && rsiVal <= 30
          ? "낙폭이 큰 구간이라 기술적 반등 여부를 지켜볼 만해요."
          : aboveTrend === true
            ? "전반적으로 흐름은 양호한 편이에요."
            : "특별한 과열·급변 신호는 크지 않아요.";
  items.push({
    icon: "summary",
    title: "한마디로",
    text: `오늘 ${pctText(chg)} ${keyDir}${signals.length ? `, ${signals.slice(0, 2).join(" · ")}` : ""}. ${keyTail}`,
    tone: chg > 0.1 ? "up" : chg < -0.1 ? "down" : "neutral",
  });

  // 1) 가격 흐름
  const dir = chg > 0.1 ? "올랐어요" : chg < -0.1 ? "내렸어요" : "거의 변동이 없어요";
  const tone: ExplainTone = chg > 0.1 ? "up" : chg < -0.1 ? "down" : "neutral";
  let priceText = `오늘은 전일 대비 ${pctText(chg)} ${dir}.`;
  if (candles.length >= 2) {
    const first = candles[0].close;
    const last = candles[candles.length - 1].close;
    const periodChg = ((last - first) / first) * 100;
    const days = candles.length;
    priceText += ` 최근 ${days}거래일 동안은 ${pctText(periodChg)} ${
      periodChg > 0 ? "상승" : periodChg < 0 ? "하락" : "보합"
    }했어요.`;
    if (Math.abs(chg) > 4) {
      priceText += " 하루 변동폭이 큰 편이라, 큰 뉴스나 이벤트가 있었을 가능성이 높아요.";
    }
  }
  items.push({ icon: "price", title: "가격 흐름", text: priceText, tone });

  // 2) 거래량 (history 기반 - quote.volume이 0인 종목도 보완)
  const vols = candles.map((c) => c.volume).filter((v) => v > 0);
  if (vols.length >= 6) {
    const recent = vols[vols.length - 1];
    const base = vols.slice(-21, -1);
    const avg = base.reduce((a, b) => a + b, 0) / (base.length || 1);
    const ratio = avg > 0 ? recent / avg : 1;
    let volText: string;
    let volTone: ExplainTone = "neutral";
    if (ratio >= 2) {
      volText = `최근 거래량이 평소(약 20거래일 평균)의 ${ratio.toFixed(1)}배로 크게 늘었어요. 거래가 갑자기 몰리는 건 보통 큰 뉴스·실적·수급 변화처럼 관심이 집중되는 이슈가 있을 때예요.`;
      volTone = chg >= 0 ? "up" : "down";
    } else if (ratio >= 1.3) {
      volText = `거래량이 평소보다 다소 많아요(약 ${ratio.toFixed(1)}배). 관심이 늘고 있다는 신호일 수 있어요.`;
    } else if (ratio <= 0.6) {
      volText = `거래량이 평소보다 적은 편이에요. 시장의 관심이 잠잠하다는 뜻으로, 가격 움직임도 작은 경우가 많아요.`;
    } else {
      volText = `거래량은 평소와 비슷한 수준이에요.`;
    }
    items.push({ icon: "volume", title: "거래량", text: volText, tone: volTone });
  }

  // 3) 추세 (이동평균)
  const e20 = ema(candles, 20).at(-1)?.value;
  const e60 = ema(candles, 60).at(-1)?.value;
  if (e20 != null && e60 != null) {
    const above = quote.price >= e60;
    const cross = e20 >= e60;
    const trendText = above
      ? `현재가가 중기 평균선(60일선) 위에 있어요. 보통 이런 상태를 "상승 추세"로 봅니다. 단기 평균선(20일선)도 중기선 ${cross ? "위" : "아래"}에 있어요.`
      : `현재가가 중기 평균선(60일선) 아래에 있어요. 보통 이런 상태를 "하락/약세 추세"로 봅니다. 반등하려면 평균선들을 다시 넘어서는 흐름이 필요해요.`;
    items.push({ icon: "trend", title: "추세(이동평균선)", text: trendText, tone: above ? "up" : "down" });
  }

  // 4) RSI (과열/침체)
  const rsiLast = rsi(candles, 14).at(-1)?.value;
  if (rsiLast != null) {
    let rsiText: string;
    let rsiTone: ExplainTone = "neutral";
    if (rsiLast >= 70) {
      rsiText = `RSI ${rsiLast.toFixed(0)} — "과매수" 구간이에요. 단기간에 많이 올라 과열됐다는 신호로, 잠시 쉬거나 조정(하락)이 나올 수도 있어요. (RSI는 0~100 사이로 매수세 강도를 나타내요)`;
      rsiTone = "down";
    } else if (rsiLast <= 30) {
      rsiText = `RSI ${rsiLast.toFixed(0)} — "과매도" 구간이에요. 단기간에 많이 빠져 낙폭이 과하다는 신호로, 기술적 반등이 나올 수도 있어요.`;
      rsiTone = "up";
    } else {
      rsiText = `RSI ${rsiLast.toFixed(0)} — 과열도 침체도 아닌 중립 구간이에요. (RSI는 매수세 강도를 0~100으로 나타내며 70 이상은 과열, 30 이하는 침체로 봐요)`;
    }
    items.push({ icon: "rsi", title: "단기 과열/침체(RSI)", text: rsiText, tone: rsiTone });
  }

  // 5) 밸류에이션 (펀더멘털 실데이터일 때만)
  if (fundamentals && fundamentals.source !== "mock" && fundamentals.peRatio != null) {
    const per = fundamentals.peRatio;
    let vtext = `PER ${per.toFixed(1)}배 — 회사가 버는 이익에 비해 주가가 몇 배 수준인지를 뜻해요.`;
    if (per > 0 && per < 10)
      vtext += " 숫자가 낮은 편이라 '이익 대비 저렴' 신호로 볼 수 있지만, 성장성이 낮아서일 수도 있어요.";
    else if (per > 35)
      vtext += " 숫자가 높은 편이라 '미래 성장 기대가 큰' 주식일 수 있지만, 기대가 꺾이면 변동이 클 수 있어요.";
    else vtext += " 업종 평균·과거 수치와 비교해서 보는 게 좋아요.";
    items.push({ icon: "valuation", title: "밸류에이션(PER)", text: vtext, tone: "neutral" });
  }

  // 6) 뉴스 연결
  if (news && news.length > 0) {
    const top = news.slice(0, 3).map((n) => `· ${n.title}`).join("\n");
    items.push({
      icon: "news",
      title: "최근 이런 소식이 있었어요",
      text: `${top}\n\n실적 발표, 신제품, 규제, 수급 같은 뉴스는 가격과 거래량에 직접 영향을 줄 수 있어요. 위 움직임의 배경을 기사에서 확인해 보세요.`,
      tone: "neutral",
    });
  }

  // 7) 주의 (항상)
  items.push({
    icon: "caution",
    title: "꼭 기억하세요",
    text: `이 해설은 과거·현재 데이터를 쉽게 풀어 설명한 것으로, 미래 수익을 보장하지 않아요. 한 가지 지표만 보지 말고 여러 정보를 함께 살펴보고, 투자 책임은 본인에게 있다는 점을 기억하세요.${isKr ? "" : " (해외 종목은 환율 변동도 함께 고려해야 해요)"}`,
    tone: "neutral",
  });

  return items;
}
