import { ExternalLink, Building2, Target } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getResearchReports } from "@/lib/stocks/research";
import { formatCurrency } from "@/lib/format";
import type { Market } from "@/types/stock";

interface AnalystReportsProps {
  ticker: string;
  market: Market;
  currentPrice: number;
}

export async function AnalystReports({ ticker, market, currentPrice }: AnalystReportsProps) {
  if (market !== "KR") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>애널리스트 리포트</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="py-3 text-center text-xs text-zinc-500">
            국내 종목만 증권사 리포트를 제공해요.
          </p>
        </CardContent>
      </Card>
    );
  }

  const data = await getResearchReports(ticker, 8);

  // 평균 목표주가 대비 현재가 상승여력
  const upside =
    data.avgTargetPrice && currentPrice > 0
      ? ((data.avgTargetPrice - currentPrice) / currentPrice) * 100
      : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center justify-between">
          <span>애널리스트 리포트</span>
          <span className="text-[10px] font-normal text-zinc-500">
            {data.source === "naver" ? "네이버 금융 리서치" : "샘플 데이터"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {data.reports.length === 0 ? (
          <p className="py-3 text-center text-xs text-zinc-500">최근 증권사 리포트가 없어요.</p>
        ) : (
          <>
            {data.avgTargetPrice ? (
              <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-violet-500">
                  <Target className="h-3.5 w-3.5" /> 증권사 평균 목표주가
                </div>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className="text-lg font-bold tabular-nums">
                    {formatCurrency(data.avgTargetPrice, market)}
                  </span>
                  {upside != null ? (
                    <span
                      className={`text-xs font-medium tabular-nums ${
                        upside >= 0 ? "text-emerald-500" : "text-rose-500"
                      }`}
                    >
                      현재가 대비 {upside >= 0 ? "+" : ""}
                      {upside.toFixed(1)}%
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[10px] text-zinc-500">
                  최근 리포트 {data.targetCount}건의 목표주가 평균이에요. 증권사 전망일 뿐 보장된 가격이
                  아니며, 실제 주가와 다를 수 있어요.
                </p>
              </div>
            ) : null}

            <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {data.reports.map((r, i) => (
                <li key={i} className="py-2.5">
                  <a
                    href={r.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-start gap-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="line-clamp-2 font-medium leading-snug group-hover:text-violet-500">
                        {r.title}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-zinc-500">
                        <span className="flex items-center gap-0.5">
                          <Building2 className="h-2.5 w-2.5" /> {r.broker}
                        </span>
                        <span>· {r.date}</span>
                        {r.targetPrice ? (
                          <span className="rounded bg-violet-100 px-1 py-0.5 font-medium text-violet-600 dark:bg-violet-950/60 dark:text-violet-300">
                            목표 {formatCurrency(r.targetPrice, market)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-zinc-400 opacity-0 transition-opacity group-hover:opacity-100" />
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}
