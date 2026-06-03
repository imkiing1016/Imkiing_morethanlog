"use client";

import { useEffect, useState } from "react";
import { RefreshCw, GraduationCap, Newspaper, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Market, MarketSentiment } from "@/types/stock";

interface SentimentGaugeProps {
  market: Market;
}

interface SentimentNews {
  title: string;
  link: string;
  source?: string;
}

function safeHref(link: string | undefined, title: string): string {
  if (!link || link === "#" || !/^https?:\/\//.test(link)) {
    return `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(title)}`;
  }
  return link;
}

function scoreColor(score: number): string {
  if (score >= 75) return "#10b981";
  if (score >= 60) return "#84cc16";
  if (score >= 45) return "#facc15";
  if (score >= 30) return "#f97316";
  return "#ef4444";
}

interface SentimentReason {
  label: string;
  value: number;
  text: string;
}
interface SentimentExplain {
  summary: string;
  reasons: SentimentReason[];
  biggest: string;
}

// 각 요인(모멘텀)이 "왜 이 점수인지" 상황을 풀이
function explainComponent(key: string, value: number, description: string): string {
  const hi = value >= 60;
  const lo = value <= 40;
  switch (key) {
    case "daily":
      if (hi) return `오늘 주요 지수가 ${description} 수준으로 올라, 당일 분위기가 좋아요. 지수가 오르면 투자심리도 함께 좋아져요.`;
      if (lo) return `오늘 주요 지수가 ${description}로 부진해, 당일 분위기가 가라앉았어요.`;
      return `오늘 지수 등락(${description})이 크지 않아 당일 영향은 중립이에요.`;
    case "trend":
      if (hi) return `단기 평균선(20일)이 중기선(60일)보다 위(${description})에 있어요. 상승 추세(골든크로스 성격)라 긍정적으로 봐요.`;
      if (lo) return `단기 평균선이 중기선보다 아래(${description})에 있어요. 약세 추세라 부정적 신호예요.`;
      return `단기·중기 평균선이 거의 붙어 있어(${description}) 방향성이 뚜렷하지 않아요.`;
    case "momentum":
      if (value >= 70) return `${description}로 '과매수' 상태예요. 단기간 많이 올라 과열됐다는 뜻이라, 점수는 높지만 조정 가능성도 함께 봐야 해요.`;
      if (value <= 30) return `${description}로 '과매도' 상태예요. 단기간 많이 빠져 침체된 구간이라, 기술적 반등이 나올 수도 있어요.`;
      return `${description}로 과열도 침체도 아닌 중립 모멘텀이에요.`;
    case "vix":
      if (hi) return `공포지수(${description})가 낮아 시장이 안정적이에요. VIX가 낮을수록 투자자들의 불안이 적다는 뜻이에요.`;
      if (lo) return `공포지수(${description})가 높아 불안이 큰 상태예요. 급락·불확실성이 커질 때 VIX가 치솟아요.`;
      return `공포지수(${description})는 보통 수준이에요.`;
    case "volatility":
      if (hi) return `지수 변동폭(${description})이 작아 시장이 차분해요. 출렁임이 작으면 심리가 안정적이에요.`;
      if (lo) return `지수 변동폭(${description})이 커서 시장이 불안정해요. 급등락이 크면 심리도 흔들려요.`;
      return `지수 변동폭(${description})은 보통 수준이에요.`;
    default:
      return description;
  }
}

// 초보자를 위한 시장 심리 쉬운 해설 (점수가 왜 이런지 + 요인별 원인)
function buildSentimentExplain(data: MarketSentiment): SentimentExplain {
  const s = data.score;
  let summary: string;
  if (s >= 75)
    summary = `종합 ${s.toFixed(0)}점 '매우 낙관(탐욕)'. 투자자들이 적극적으로 사는 분위기지만, 과열되면 작은 악재에도 조정이 올 수 있어요. 점수는 아래 요인들을 가중 평균해 계산돼요.`;
  else if (s >= 60)
    summary = `종합 ${s.toFixed(0)}점 '낙관'. 전반적으로 분위기가 좋아 매수세가 우위예요. 점수는 아래 요인들을 가중 평균한 결과예요.`;
  else if (s >= 45)
    summary = `종합 ${s.toFixed(0)}점 '중립'. 살지 팔지 관망하는 분위기예요. 아래 요인들이 서로 엇갈려 중립이 됐어요.`;
  else if (s >= 30)
    summary = `종합 ${s.toFixed(0)}점 '신중·불안'. 위험을 피하려는 분위기로 변동성이 커질 수 있어요. 아래 요인들이 점수를 끌어내렸어요.`;
  else
    summary = `종합 ${s.toFixed(0)}점 '공포'. 다들 불안해하는 구간인데, 과도한 공포는 반대로 저가 매수 기회가 되기도 해요(역발상). 아래 요인들이 점수를 크게 낮췄어요.`;

  const reasons = data.components.map((c) => ({
    label: c.label,
    value: c.value,
    text: explainComponent(c.key, c.value, c.description),
  }));

  // 점수에 가장 크게 기여(가중치×편차)한 요인
  const contrib = data.components
    .map((c) => ({ label: c.label, impact: (c.value - 50) * c.weight }))
    .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact))[0];
  const biggest = contrib
    ? `이번 점수에 가장 큰 영향을 준 건 '${contrib.label}'(${contrib.impact >= 0 ? "끌어올림" : "끌어내림"})이에요.`
    : "";

  return { summary, reasons, biggest };
}

export function SentimentGauge({ market }: SentimentGaugeProps) {
  const [data, setData] = useState<MarketSentiment | null>(null);
  const [news, setNews] = useState<SentimentNews[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const [sRes, nRes] = await Promise.all([
        fetch(`/api/sentiment?market=${market}`, { cache: "no-store" }),
        fetch(`/api/news?market=${market}&limit=4`, { cache: "no-store" }).catch(() => null),
      ]);
      if (!sRes.ok) throw new Error(`status ${sRes.status}`);
      setData((await sRes.json()) as MarketSentiment);
      if (nRes && nRes.ok) {
        const nj = (await nRes.json()) as { items: SentimentNews[] };
        setNews(nj.items ?? []);
      }
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
              (() => {
                const ex = buildSentimentExplain(data);
                return (
                  <div className="w-full rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
                    <div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-violet-500">
                      <GraduationCap className="h-3.5 w-3.5" /> 점수가 이렇게 나온 이유
                    </div>
                    <p className="text-xs leading-relaxed text-zinc-700 dark:text-zinc-300">
                      {ex.summary}
                    </p>
                    <ul className="mt-2 space-y-1.5">
                      {ex.reasons.map((r) => (
                        <li key={r.label} className="flex gap-2 text-[11px] leading-relaxed">
                          <span
                            className="mt-0.5 shrink-0 rounded px-1 py-0.5 text-[10px] font-semibold tabular-nums"
                            style={{ color: scoreColor(r.value), backgroundColor: `${scoreColor(r.value)}1a` }}
                          >
                            {r.value.toFixed(0)}
                          </span>
                          <span className="text-zinc-600 dark:text-zinc-300">
                            <b className="font-medium">{r.label}</b> — {r.text}
                          </span>
                        </li>
                      ))}
                    </ul>
                    {ex.biggest ? (
                      <p className="mt-2 text-[11px] font-medium text-zinc-500">{ex.biggest}</p>
                    ) : null}

                    {news.length > 0 ? (
                      <div className="mt-3 border-t border-violet-500/15 pt-2">
                        <div className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold text-zinc-500">
                          <Newspaper className="h-3 w-3" /> 심리에 영향을 줄 수 있는 최근 이슈
                        </div>
                        <ul className="space-y-1">
                          {news.slice(0, 4).map((n, i) => (
                            <li key={i}>
                              <a
                                href={safeHref(n.link, n.title)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group flex items-start gap-1.5 text-[11px] leading-snug text-zinc-600 hover:text-violet-500 dark:text-zinc-300"
                              >
                                <span className="text-violet-500">·</span>
                                <span className="line-clamp-1 flex-1">{n.title}</span>
                                <ExternalLink className="mt-0.5 h-2.5 w-2.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-100" />
                              </a>
                            </li>
                          ))}
                        </ul>
                        <p className="mt-1 text-[10px] text-zinc-400">
                          실적·금리·환율·정책 같은 이슈는 시장 분위기(심리)에 영향을 줄 수 있어요.
                        </p>
                      </div>
                    ) : null}

                    <p className="mt-2 text-[10px] text-zinc-400">
                      ※ 점수는 지수의 가격·추세·변동성으로 계산되며(뉴스는 참고용), 미래를 보장하지 않아요.
                    </p>
                  </div>
                );
              })()
            ) : null}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
