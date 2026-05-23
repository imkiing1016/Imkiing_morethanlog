"use client";

import { useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";
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
          </div>
        )}
      </CardContent>
    </Card>
  );
}
