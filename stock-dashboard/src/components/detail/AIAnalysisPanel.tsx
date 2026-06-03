"use client";

import { useState } from "react";
import { Sparkles, RefreshCw, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { AnalysisReport } from "@/types/stock";

interface AIAnalysisPanelProps {
  ticker: string;
  market: "KR" | "US";
}

export function AIAnalysisPanel({ ticker, market }: AIAnalysisPanelProps) {
  const [report, setReport] = useState<AnalysisReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fullTicker = market === "KR" ? `${ticker}.KS` : ticker;

  const load = async (refresh = false) => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/analyze/${encodeURIComponent(fullTicker)}${refresh ? "?refresh=1" : ""}`;
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const json = (await res.json()) as AnalysisReport;
      setReport(json);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between pb-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-500" /> AI 분석 리포트
          </CardTitle>
          <p className="mt-1 text-xs text-zinc-500">
            차트 기술지표 · 펀더멘털(재무) · 최근 뉴스를 종합한 보조 분석
          </p>
        </div>
        <div className="flex gap-2">
          {report ? (
            <Button variant="ghost" size="icon" onClick={() => load(true)} aria-label="갱신">
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>
        {!report ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <p className="max-w-sm text-sm text-zinc-500">
              버튼을 눌러 AI 분석 리포트를 생성하세요. 로컬 LLM(LM Studio 등)이 실행 중이면 차트·재무·뉴스를
              종합한 분석을, 아니면 지표 기반 자동 분석을 제공합니다.
            </p>
            <Button onClick={() => load(false)} variant="primary" disabled={loading}>
              <Sparkles className="h-4 w-4" /> {loading ? "생성 중..." : "분석 생성"}
            </Button>
            {error ? (
              <p className="flex items-center gap-1 text-xs text-rose-500">
                <AlertTriangle className="h-3 w-3" /> {error}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={riskTone(report.riskLevel)}>리스크 {riskKr(report.riskLevel)}</Badge>
              <Badge tone={report.source === "local" ? "info" : "warning"}>
                {report.source === "local" ? "로컬 LLM 분석" : "지표 기반 자동 분석"}
              </Badge>
              {report.fromCache ? <Badge>캐시</Badge> : null}
              <span className="text-xs text-zinc-500">
                {new Date(report.generatedAt).toLocaleString()}
              </span>
            </div>

            {/* AI 종합 추천: 매수 관점 / 관망 / 매도 관점 */}
            <div
              className={`flex items-start gap-3 rounded-lg border p-3 ${recTone(report.recommendation).bg}`}
            >
              <div
                className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lg font-bold ${recTone(report.recommendation).icon}`}
              >
                {recIcon(report.recommendation)}
              </div>
              <div className="min-w-0 flex-1">
                <div className={`text-sm font-semibold ${recTone(report.recommendation).text}`}>
                  AI 추천: {recKr(report.recommendation)}
                </div>
                <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-600 dark:text-zinc-300">
                  {recReason(report)}
                </p>
                <p className="mt-1 text-[10px] text-zinc-400">
                  ⚠ "매수/매도 관점"은 강세·약세 신호의 가중치를 비교한 <b>참고용 신호</b>로,
                  실제 매수·매도를 권유하지 않아요. 투자 판단·책임은 본인에게 있습니다.
                </p>
              </div>
            </div>

            <p className="text-sm leading-relaxed">{report.summary}</p>
            <div className="grid gap-3 md:grid-cols-2">
              <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-500">
                  <TrendingUp className="h-3.5 w-3.5" /> 강세 포인트
                </div>
                <ul className="space-y-1.5 text-sm">
                  {report.bullish.map((b, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-emerald-500">·</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg border border-rose-500/20 bg-rose-500/5 p-3">
                <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-rose-500">
                  <TrendingDown className="h-3.5 w-3.5" /> 약세 포인트
                </div>
                <ul className="space-y-1.5 text-sm">
                  {report.bearish.map((b, i) => (
                    <li key={i} className="flex gap-2">
                      <span className="text-rose-500">·</span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <div>
              <div className="mb-1 text-xs font-semibold text-zinc-500">전망</div>
              <p className="text-sm leading-relaxed text-zinc-700 dark:text-zinc-300">
                {report.outlook}
              </p>
            </div>
            <p className="text-[10px] text-zinc-400">
              ⚠ 본 리포트는 참고용이며 투자 판단의 근거가 될 수 없습니다.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function riskTone(risk: AnalysisReport["riskLevel"]) {
  if (risk === "high") return "down" as const;
  if (risk === "medium") return "warning" as const;
  return "up" as const;
}

function riskKr(risk: AnalysisReport["riskLevel"]) {
  return risk === "high" ? "높음" : risk === "medium" ? "보통" : "낮음";
}

function recKr(rec: AnalysisReport["recommendation"]) {
  return rec === "buy" ? "매수 관점" : rec === "sell" ? "매도 관점" : "관망 (중립)";
}

function recIcon(rec: AnalysisReport["recommendation"]) {
  return rec === "buy" ? "▲" : rec === "sell" ? "▼" : "■";
}

function recTone(rec: AnalysisReport["recommendation"]) {
  if (rec === "buy")
    return {
      bg: "border-emerald-500/30 bg-emerald-500/5",
      icon: "bg-emerald-500 text-white",
      text: "text-emerald-600 dark:text-emerald-400",
    };
  if (rec === "sell")
    return {
      bg: "border-rose-500/30 bg-rose-500/5",
      icon: "bg-rose-500 text-white",
      text: "text-rose-600 dark:text-rose-400",
    };
  return {
    bg: "border-zinc-300 bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900/40",
    icon: "bg-zinc-400 text-white",
    text: "text-zinc-700 dark:text-zinc-200",
  };
}

function recReason(r: AnalysisReport) {
  const b = r.bullish.length;
  const s = r.bearish.length;
  if (r.recommendation === "buy")
    return `강세 포인트(${b}) > 약세 포인트(${s}). 차트·재무·뉴스 신호가 대체로 우호적이라 매수 관점이 우세한 국면이에요.`;
  if (r.recommendation === "sell")
    return `약세 포인트(${s}) > 강세 포인트(${b}). 차트·재무·뉴스 신호가 대체로 부담스러워 매도 관점이 우세한 국면이에요.`;
  return `강세(${b})·약세(${s}) 신호가 비슷하게 엇갈려 관망(중립) 구간으로 보여요.`;
}
