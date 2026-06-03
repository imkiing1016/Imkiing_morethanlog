"use client";

import { useState } from "react";
import { FlaskConical, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface BacktestCardProps {
  ticker: string;
  market: "KR" | "US";
}

interface StratStat {
  signals: number;
  hits: number;
  hitRate: number;
  avgReturn: number;
}
interface StrategyResult {
  buy: StratStat;
  sell: StratStat;
  directionalAccuracy: number;
}
interface BacktestResult {
  ticker: string;
  samples: number;
  horizon: number;
  spanDays: number;
  baseUpRate: number;
  buyHoldReturn: number;
  engine: StrategyResult;
  naive: StrategyResult;
  improvement: number;
}

const fullTicker = (t: string, m: string) => (m === "KR" ? `${t}.KS` : t);

export function BacktestCard({ ticker, market }: BacktestCardProps) {
  const [horizon, setHorizon] = useState(5);
  const [data, setData] = useState<BacktestResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (h: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/backtest/${encodeURIComponent(fullTicker(ticker, market))}?horizon=${h}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error ?? `status ${res.status}`);
      }
      setData((await res.json()) as BacktestResult);
      setHorizon(h);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-violet-500" /> 신호 정확도 백테스트
        </CardTitle>
        <p className="text-xs text-zinc-500">
          과거 2년 일봉으로 매수/매도 신호를 재현해 N일 후 실제 등락과 비교합니다.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {!data ? (
          <div className="flex flex-col items-center gap-3 py-4 text-center">
            <p className="max-w-sm text-xs text-zinc-500">
              신규 다요인 엔진(기술 축)과 단순 추세(이전 방식)의 방향 정확도를 같은 기간에 비교합니다.
            </p>
            <div className="flex gap-2">
              <Button onClick={() => run(5)} variant="primary" size="sm" disabled={loading}>
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FlaskConical className="h-3.5 w-3.5" />}
                5일 후 기준 실행
              </Button>
              <Button onClick={() => run(20)} variant="outline" size="sm" disabled={loading}>
                20일 후 기준
              </Button>
            </div>
            {error ? <p className="text-xs text-rose-500">{error}</p> : null}
          </div>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
                표본 {data.samples}일 · {data.horizon}일 후 검증
              </span>
              <span className="text-zinc-500">
                구간 매수후보유 {data.buyHoldReturn >= 0 ? "+" : ""}
                {data.buyHoldReturn.toFixed(1)}% · 상승빈도 {data.baseUpRate.toFixed(0)}%
              </span>
            </div>

            {/* 핵심: 방향 정확도 비교 */}
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3">
                <div className="text-[11px] font-semibold text-violet-500">신규 엔진</div>
                <div className="text-2xl font-bold tabular-nums">
                  {data.engine.directionalAccuracy.toFixed(1)}%
                </div>
                <div className="text-[10px] text-zinc-500">방향 정확도</div>
              </div>
              <div className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800">
                <div className="text-[11px] font-semibold text-zinc-500">단순 추세(이전)</div>
                <div className="text-2xl font-bold tabular-nums text-zinc-500">
                  {data.naive.directionalAccuracy.toFixed(1)}%
                </div>
                <div className="text-[10px] text-zinc-500">방향 정확도</div>
              </div>
            </div>

            <div
              className={`rounded-lg px-3 py-2 text-xs font-medium ${
                data.improvement >= 0
                  ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                  : "bg-rose-500/10 text-rose-600 dark:text-rose-400"
              }`}
            >
              이전 대비 {data.improvement >= 0 ? "+" : ""}
              {data.improvement.toFixed(1)}%p {data.improvement >= 0 ? "개선" : "하락"}
            </div>

            {/* 매수/매도별 상세 */}
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
                  <th className="py-1 text-left font-medium">신호</th>
                  <th className="py-1 text-right font-medium">발동</th>
                  <th className="py-1 text-right font-medium">적중률</th>
                  <th className="py-1 text-right font-medium">평균 {data.horizon}일 수익</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-1 text-emerald-500">매수</td>
                  <td className="py-1 text-right tabular-nums">{data.engine.buy.signals}</td>
                  <td className="py-1 text-right tabular-nums">{data.engine.buy.hitRate.toFixed(0)}%</td>
                  <td className="py-1 text-right tabular-nums">
                    {data.engine.buy.avgReturn >= 0 ? "+" : ""}
                    {data.engine.buy.avgReturn.toFixed(2)}%
                  </td>
                </tr>
                <tr>
                  <td className="py-1 text-rose-500">매도</td>
                  <td className="py-1 text-right tabular-nums">{data.engine.sell.signals}</td>
                  <td className="py-1 text-right tabular-nums">{data.engine.sell.hitRate.toFixed(0)}%</td>
                  <td className="py-1 text-right tabular-nums">
                    {data.engine.sell.avgReturn >= 0 ? "+" : ""}
                    {data.engine.sell.avgReturn.toFixed(2)}%
                  </td>
                </tr>
              </tbody>
            </table>

            <div className="flex gap-2">
              <Button onClick={() => run(5)} variant="outline" size="sm" disabled={loading}>
                5일
              </Button>
              <Button onClick={() => run(20)} variant="outline" size="sm" disabled={loading}>
                20일
              </Button>
              {loading ? <Loader2 className="h-4 w-4 animate-spin text-zinc-400" /> : null}
            </div>

            <p className="text-[10px] leading-relaxed text-zinc-400">
              ⚠️ 펀더멘털·수급·시장분위기는 과거 스냅샷이 없어 <b>기술적 신호만</b> 검증한 결과예요. 매수
              적중=상승, 매도 적중=하락 기준. 과거 성과가 미래를 보장하지 않으며 거래비용은 미반영입니다.
            </p>
          </>
        )}
      </CardContent>
    </Card>
  );
}
