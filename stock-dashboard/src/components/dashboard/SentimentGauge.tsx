"use client";

import { useEffect, useState } from "react";
import { RefreshCw, GraduationCap } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Market, MarketSentiment } from "@/types/stock";

interface SentimentGaugeProps {
  market: Market;
}

function scoreColor(score: number): string {
  if (score >= 75) return "#10b981";
  if (score >= 60) return "#84cc16";
  if (score >= 45) return "#facc15";
  if (score >= 30) return "#f97316";
  return "#ef4444";
}

// 초보자를 위한 시장 심리 쉬운 해설
function buildSentimentExplain(data: MarketSentiment): string {
  const s = data.score;
  let base: string;
  if (s >= 75)
    base = `지금 시장 심리는 ${s.toFixed(0)}점으로 '매우 낙관(탐욕)' 상태예요. 투자자들이 적극적으로 사는 분위기지만, 과열되면 작은 악재에도 조정(하락)이 올 수 있어 욕심은 조심하는 게 좋아요.`;
  else if (s >= 60)
    base = `지금 시장 심리는 ${s.toFixed(0)}점으로 '낙관' 쪽이에요. 전반적으로 분위기가 좋은 편이라 매수세가 우위인 상태예요.`;
  else if (s >= 45)
    base = `지금 시장 심리는 ${s.toFixed(0)}점으로 '중립'이에요. 살지 팔지 눈치 보는 관망 분위기로, 방향이 정해지길 기다리는 구간일 때가 많아요.`;
  else if (s >= 30)
    base = `지금 시장 심리는 ${s.toFixed(0)}점으로 '신중·불안' 쪽이에요. 투자자들이 위험을 피하려는 분위기라 변동성이 커질 수 있어요.`;
  else
    base = `지금 시장 심리는 ${s.toFixed(0)}점으로 '공포' 상태예요. 다들 불안해하는 구간인데, 과도한 공포는 반대로 저가 매수 기회가 되기도 해요(역발상).`;

  const sorted = [...data.components].sort((a, b) => b.value - a.value);
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  let detail = "";
  if (best && worst && best.key !== worst.key) {
    detail = ` 가장 긍정적인 요인은 '${best.label}', 가장 약한 요인은 '${worst.label}'이에요.`;
  }
  return base + detail + " (이 점수는 군중심리 참고용이며, 미래를 보장하지 않아요)";
}

export function SentimentGauge({ market }: SentimentGaugeProps) {
  const [data, setData] = useState<MarketSentiment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/sentiment?market=${market}`, { cache: "no-store" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = (await res.json()) as MarketSentiment;
      setData(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 5 * 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [market]);

  const score = data?.score ?? 50;
  const color = data ? scoreColor(score) : "#71717a";
  const angle = -90 + (score / 100) * 180;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle>
            시장 심리 ({market === "KR" ? "한국" : "미국"})
          </CardTitle>
          <p className="mt-1 text-xs text-zinc-500">
            지수, 추세, RSI{market === "US" ? ", VIX" : ", 변동성"} 기반 종합 점수
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={load} aria-label="새로고침">
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </CardHeader>
      <CardContent>
        {error ? (
          <p className="text-xs text-rose-500">로드 실패: {error}</p>
        ) : loading && !data ? (
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="h-32 w-56 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
            <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="h-14 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800"
                />
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div className="relative h-32 w-56">
              <svg viewBox="0 0 200 110" className="h-full w-full">
                <defs>
                  <linearGradient id="gauge-gradient" x1="0%" x2="100%">
                    <stop offset="0%" stopColor="#ef4444" />
                    <stop offset="25%" stopColor="#f97316" />
                    <stop offset="50%" stopColor="#facc15" />
                    <stop offset="75%" stopColor="#84cc16" />
                    <stop offset="100%" stopColor="#10b981" />
                  </linearGradient>
                </defs>
                <path
                  d="M 10 100 A 90 90 0 0 1 190 100"
                  fill="none"
                  stroke="url(#gauge-gradient)"
                  strokeWidth="14"
                  strokeLinecap="round"
                />
                <g transform={`translate(100 100) rotate(${angle})`}>
                  <line
                    x1="0"
                    y1="0"
                    x2="0"
                    y2="-70"
                    stroke={color}
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                  <circle cx="0" cy="0" r="6" fill={color} />
                </g>
              </svg>
              <div className="absolute inset-x-0 bottom-0 text-center">
                <div className="text-3xl font-bold tabular-nums" style={{ color }}>
                  {score.toFixed(0)}
                </div>
                <div className="text-xs font-medium" style={{ color }}>
                  {data?.label ?? "..."}
                </div>
              </div>
            </div>
            <div className="grid w-full grid-cols-1 gap-2 pt-2 sm:grid-cols-2">
              {data?.components.map((c) => (
                <div
                  key={c.key}
                  className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-800"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{c.label}</span>
                    <span
                      className="text-xs font-semibold tabular-nums"
                      style={{ color: scoreColor(c.value) }}
                    >
                      {c.value.toFixed(0)}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${c.value}%`, backgroundColor: scoreColor(c.value) }}
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-zinc-500">{c.description}</p>
                </div>
              ))}
            </div>
            {data ? (
              <div className="w-full rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
                <div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-violet-500">
                  <GraduationCap className="h-3.5 w-3.5" /> 쉬운 해설
                </div>
                <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                  {buildSentimentExplain(data)}
                </p>
              </div>
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
