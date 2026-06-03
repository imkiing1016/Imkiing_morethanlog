import { Gauge } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getFundamentals } from "@/lib/stocks/fundamentals";
import { getStockNews } from "@/lib/stocks/news";
import { getMarketSentiment } from "@/lib/stocks/sentiment";
import { getKrIntegration } from "@/lib/stocks/kr-integration";
import { computeVerdict, type Lean, type Recommendation } from "@/lib/analysis/engine";
import { formatCurrency } from "@/lib/format";
import type { Candle, Market, Quote } from "@/types/stock";

interface VerdictCardProps {
  quote: Quote;
  candles: Candle[];
  ticker: string;
  market: Market;
}

function leanText(l: Lean): string {
  return l === "good" ? "text-emerald-600 dark:text-emerald-400" : l === "bad" ? "text-rose-600 dark:text-rose-400" : "text-zinc-500";
}
function leanBar(l: Lean): string {
  return l === "good" ? "bg-emerald-500" : l === "bad" ? "bg-rose-500" : "bg-zinc-400";
}

const REC_STYLE: Record<Recommendation, { bg: string; text: string; icon: string; ring: string }> = {
  strong_buy: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", icon: "▲▲", ring: "border-emerald-500/40" },
  buy: { bg: "bg-emerald-500/10", text: "text-emerald-600 dark:text-emerald-400", icon: "▲", ring: "border-emerald-500/30" },
  hold: { bg: "bg-zinc-500/10", text: "text-zinc-700 dark:text-zinc-200", icon: "■", ring: "border-zinc-400/40" },
  reduce: { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", icon: "▽", ring: "border-rose-500/30" },
  sell: { bg: "bg-rose-500/10", text: "text-rose-600 dark:text-rose-400", icon: "▼", ring: "border-rose-500/40" },
};

export async function VerdictCard({ quote, candles, ticker, market }: VerdictCardProps) {
  const [fundamentals, news, sentiment, kr] = await Promise.all([
    getFundamentals(ticker).catch(() => undefined),
    getStockNews(ticker, 6).catch(() => []),
    getMarketSentiment(market).catch(() => null),
    market === "KR" ? getKrIntegration(ticker).catch(() => null) : Promise.resolve(null),
  ]);

  const v = computeVerdict({
    quote,
    candles,
    fundamentals,
    news,
    marketScore: sentiment?.score,
    supply: kr?.supply,
    consensus: kr?.consensus,
  });
  const consensus = kr?.consensus;
  const upside =
    consensus?.priceTargetMean && quote.price > 0
      ? ((consensus.priceTargetMean - quote.price) / quote.price) * 100
      : null;
  const rec = REC_STYLE[v.recommendation];
  const confKr = v.confidence === "high" ? "높음" : v.confidence === "medium" ? "보통" : "낮음";

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Gauge className="h-4 w-4 text-violet-500" /> 종합 판단
          </span>
          <span className="text-[10px] font-normal text-zinc-500">신뢰도 {confKr}</span>
        </CardTitle>
        <p className="text-xs text-zinc-500">
          7개 축(추세·모멘텀·변동성·거래량·밸류·시장분위기·뉴스)을 가중 종합한 참고 지표
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 종합 점수 + 추천 */}
        <div className={`flex items-center gap-4 rounded-xl border p-4 ${rec.bg} ${rec.ring}`}>
          <div className="text-center">
            <div className={`text-3xl font-bold tabular-nums ${rec.text}`}>{v.composite}</div>
            <div className="text-[10px] text-zinc-500">/ 100</div>
          </div>
          <div className="min-w-0 flex-1">
            <div className={`flex items-center gap-1.5 text-lg font-bold ${rec.text}`}>
              <span>{rec.icon}</span>
              {v.recLabel}
            </div>
            <p className="mt-0.5 text-[11px] text-zinc-500">
              데이터 충실도: {v.confidenceReason}
            </p>
          </div>
        </div>

        {/* 축별 점수 막대 */}
        <div className="space-y-2">
          {v.axes.map((a) => (
            <div key={a.key} className="flex items-center gap-2 text-xs">
              <span className="w-20 shrink-0 text-zinc-500">{a.label}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                <div className={`h-full rounded-full ${leanBar(a.lean)}`} style={{ width: `${a.score}%` }} />
              </div>
              <span className={`w-8 shrink-0 text-right font-semibold tabular-nums ${leanText(a.lean)}`}>
                {a.score.toFixed(0)}
              </span>
              <span className="hidden w-48 shrink-0 truncate text-[10px] text-zinc-400 sm:inline">
                {a.detail}
              </span>
            </div>
          ))}
        </div>

        {/* 애널리스트 컨센서스 목표가 */}
        {consensus?.priceTargetMean ? (
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-violet-500/20 bg-violet-500/5 px-3 py-2 text-xs">
            <span className="font-semibold text-violet-500">컨센서스 목표가</span>
            <span className="tabular-nums font-bold">
              {formatCurrency(consensus.priceTargetMean, market)}
            </span>
            {upside != null ? (
              <span
                className={`tabular-nums font-medium ${upside >= 0 ? "text-emerald-500" : "text-rose-500"}`}
              >
                현재가 대비 {upside >= 0 ? "+" : ""}
                {upside.toFixed(1)}%
              </span>
            ) : null}
            {consensus.recommMean != null ? (
              <span className="text-zinc-500">· 투자의견 {consensus.recommMean.toFixed(2)}/5</span>
            ) : null}
          </div>
        ) : null}

        {/* 참고 지지/저항 */}
        {v.levels.support != null && v.levels.resistance != null ? (
          <div className="flex flex-wrap gap-3 rounded-lg border border-zinc-200 px-3 py-2 text-xs dark:border-zinc-800">
            <span className="text-zinc-500">참고 레벨</span>
            <span>
              지지 <b className="tabular-nums">{formatCurrency(v.levels.support, market)}</b>
            </span>
            <span>
              저항 <b className="tabular-nums">{formatCurrency(v.levels.resistance, market)}</b>
            </span>
            {v.levels.atrPct != null ? (
              <span className="text-zinc-500">· 일변동성(ATR) {v.levels.atrPct.toFixed(1)}%</span>
            ) : null}
          </div>
        ) : null}

        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-[11px] leading-relaxed text-amber-700 dark:text-amber-300">
          ⚠️ 데이터를 규칙에 따라 점수화한 <b>참고용 신호</b>로 <b>매수·매도를 권유하지 않습니다.</b>{" "}
          지지/저항은 과거 고저 기반 참고선이며, 신뢰도가 낮을수록(데이터 부족) 해석에 주의하세요. 투자
          책임은 본인에게 있습니다.
        </p>
      </CardContent>
    </Card>
  );
}
