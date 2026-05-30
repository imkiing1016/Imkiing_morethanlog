import { Scale, Activity, Target, Gauge } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getFundamentals } from "@/lib/stocks/fundamentals";
import { getResearchReports } from "@/lib/stocks/research";
import { ema, rsi } from "@/lib/stocks/indicators";
import { formatCurrency } from "@/lib/format";
import type { Candle, Market, Quote } from "@/types/stock";

interface VerdictCardProps {
  quote: Quote;
  candles: Candle[];
  ticker: string;
  market: Market;
}

type Lean = "good" | "bad" | "neutral";

function leanClass(l: Lean): string {
  if (l === "good") return "border-emerald-500/30 bg-emerald-500/5 text-emerald-600 dark:text-emerald-400";
  if (l === "bad") return "border-rose-500/30 bg-rose-500/5 text-rose-600 dark:text-rose-400";
  return "border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300";
}

export async function VerdictCard({ quote, candles, ticker, market }: VerdictCardProps) {
  const [fundamentals, research] = await Promise.all([
    getFundamentals(ticker).catch(() => undefined),
    market === "KR" ? getResearchReports(ticker, 8).catch(() => null) : Promise.resolve(null),
  ]);

  let score = 0;

  // 1) 밸류에이션 (실데이터일 때만)
  let valuation: "저평가" | "적정" | "고평가" | "정보 부족" = "정보 부족";
  let valLean: Lean = "neutral";
  let valReason = "PER·PBR 데이터가 없어요";
  if (
    fundamentals &&
    fundamentals.source !== "mock" &&
    (fundamentals.peRatio != null || fundamentals.pbRatio != null)
  ) {
    let vs = 0;
    const per = fundamentals.peRatio;
    const pbr = fundamentals.pbRatio;
    if (per != null) {
      if (per > 0 && per < 10) vs += 1;
      else if (per > 35) vs -= 1;
    }
    if (pbr != null) {
      if (pbr < 1) vs += 1;
      else if (pbr > 5) vs -= 1;
    }
    valuation = vs >= 1 ? "저평가" : vs <= -1 ? "고평가" : "적정";
    valLean = vs >= 1 ? "good" : vs <= -1 ? "bad" : "neutral";
    valReason = `PER ${per?.toFixed(1) ?? "—"} · PBR ${pbr?.toFixed(1) ?? "—"}`;
    score += vs;
  }

  // 2) 기술적 신호 (이동평균 추세 + RSI)
  const e20 = ema(candles, 20).at(-1)?.value;
  const e60 = ema(candles, 60).at(-1)?.value;
  const above = e20 != null && e60 != null ? quote.price >= e60 : null;
  const cross = e20 != null && e60 != null ? e20 >= e60 : null;
  const rsiV = rsi(candles, 14).at(-1)?.value;
  if (above === true) score += 1;
  if (above === false) score -= 1;
  if (cross === true) score += 0.5;
  if (rsiV != null) {
    if (rsiV <= 30) score += 1;
    else if (rsiV >= 70) score -= 1;
  }
  const techParts: string[] = [];
  if (above != null) techParts.push(above ? "60일선 위(상승추세)" : "60일선 아래(약세)");
  if (rsiV != null)
    techParts.push(`RSI ${rsiV.toFixed(0)}${rsiV >= 70 ? "(과열)" : rsiV <= 30 ? "(과매도)" : ""}`);
  const techLean: Lean = above === true && (rsiV == null || rsiV < 70) ? "good" : above === false ? "bad" : "neutral";

  // 3) 애널리스트 목표주가 (국내)
  const avgTarget = research?.avgTargetPrice;
  const upside = avgTarget && quote.price > 0 ? ((avgTarget - quote.price) / quote.price) * 100 : null;
  if (upside != null) {
    if (upside > 15) score += 1;
    else if (upside < -5) score -= 1;
  }
  const analystLean: Lean = upside == null ? "neutral" : upside > 5 ? "good" : upside < -5 ? "bad" : "neutral";

  // 종합 신호
  const signal =
    score >= 2.5
      ? { text: "긍정적 신호", lean: "good" as Lean }
      : score >= 1
        ? { text: "다소 긍정", lean: "good" as Lean }
        : score <= -2.5
          ? { text: "부정적 신호", lean: "bad" as Lean }
          : score <= -1
            ? { text: "주의 신호", lean: "bad" as Lean }
            : { text: "중립", lean: "neutral" as Lean };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-violet-500" /> 종합 판단
          </span>
          <span
            className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${leanClass(signal.lean)}`}
          >
            {signal.text}
          </span>
        </CardTitle>
        <p className="text-xs text-zinc-500">
          밸류에이션·기술적 신호·애널리스트 목표가를 종합한 참고 지표예요
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-2.5 sm:grid-cols-3">
          <div className={`rounded-lg border p-3 ${leanClass(valLean)}`}>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold">
              <Scale className="h-3.5 w-3.5" /> 밸류에이션
            </div>
            <div className="mt-1 text-base font-bold">{valuation}</div>
            <div className="text-[10px] opacity-80">{valReason}</div>
          </div>

          <div className={`rounded-lg border p-3 ${leanClass(techLean)}`}>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold">
              <Activity className="h-3.5 w-3.5" /> 기술적 신호
            </div>
            <div className="mt-1 text-base font-bold">
              {techLean === "good" ? "양호" : techLean === "bad" ? "약세" : "중립"}
            </div>
            <div className="text-[10px] opacity-80">{techParts.join(" · ") || "데이터 부족"}</div>
          </div>

          <div className={`rounded-lg border p-3 ${leanClass(analystLean)}`}>
            <div className="flex items-center gap-1.5 text-[11px] font-semibold">
              <Target className="h-3.5 w-3.5" /> 애널리스트 목표가
            </div>
            <div className="mt-1 text-base font-bold tabular-nums">
              {avgTarget ? formatCurrency(avgTarget, market) : market === "KR" ? "리포트 없음" : "국내만"}
            </div>
            <div className="text-[10px] opacity-80">
              {upside != null ? `현재가 대비 ${upside >= 0 ? "+" : ""}${upside.toFixed(1)}%` : "—"}
            </div>
          </div>
        </div>

        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
          ⚠️ 이 종합 판단은 데이터를 규칙에 따라 점수화한 <b>참고용 신호</b>로, <b>매수·매도를 권유하지 않습니다.</b>{" "}
          여러 지표가 엇갈릴 수 있고 미래를 보장하지 않으니, 아래 상세 분석(차트·재무·뉴스·AI 분석)과 함께
          종합적으로 판단하세요. 투자 책임은 본인에게 있어요.
        </p>
      </CardContent>
    </Card>
  );
}
