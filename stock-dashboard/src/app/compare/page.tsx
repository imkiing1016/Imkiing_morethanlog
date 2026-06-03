import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompareChart, COLORS } from "@/components/compare/CompareChart";
import { CompareControls } from "@/components/compare/CompareControls";
import { getHistory, getQuote } from "@/lib/stocks/provider";
import { changeBg, formatCompactNumber, formatCurrency, formatPercent } from "@/lib/format";
import type { Range } from "@/types/stock";

interface PageProps {
  searchParams: Promise<{ tickers?: string; range?: string }>;
}

const VALID_RANGES: Range[] = ["1mo", "3mo", "6mo", "1y", "2y", "5y", "max"];

export default async function ComparePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const tickerList = (sp.tickers ?? "")
    .split(",")
    .map((t) => t.trim().toUpperCase())
    .filter(Boolean)
    .slice(0, 4);

  const range = (VALID_RANGES.includes(sp.range as Range) ? sp.range : "6mo") as Range;

  const [quotes, histories] = await Promise.all([
    Promise.all(tickerList.map((t) => getQuote(t).catch(() => null))),
    Promise.all(tickerList.map((t) => getHistory(t, range).catch(() => []))),
  ]);

  const series = tickerList
    .map((t, i) => {
      const q = quotes[i];
      const candles = histories[i];
      if (!q || candles.length === 0) return null;
      return {
        ticker: t,
        name: q.name,
        candles,
        color: COLORS[i % COLORS.length],
      };
    })
    .filter((s): s is NonNullable<typeof s> => s !== null);

  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <div>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-100"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> 대시보드
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold tracking-tight">종목 비교</h1>
        <p className="mt-1 text-xs text-zinc-500">
          최대 4개 종목의 수익률을 동일 기준점에서 비교합니다.
        </p>
      </div>

      <CompareControls tickers={tickerList} />

      {tickerList.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          위에서 비교할 종목을 추가하세요.
          <div className="mt-2 flex flex-wrap justify-center gap-2 text-xs">
            <Link
              href="/compare?tickers=AAPL,MSFT,NVDA&range=6mo"
              className="rounded-full border border-zinc-300 px-3 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              빅테크 3사
            </Link>
            <Link
              href="/compare?tickers=005930,000660,035420&range=6mo"
              className="rounded-full border border-zinc-300 px-3 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              한국 대표주
            </Link>
            <Link
              href="/compare?tickers=TSLA,NVDA&range=1y"
              className="rounded-full border border-zinc-300 px-3 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            >
              TSLA vs NVDA
            </Link>
          </div>
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>누적 수익률</CardTitle>
              <p className="text-xs text-zinc-500">기간 시작일을 0%로 정규화한 차트</p>
            </CardHeader>
            <CardContent>
              {series.length > 0 ? (
                <CompareChart series={series} />
              ) : (
                <p className="py-12 text-center text-xs text-zinc-500">
                  데이터를 불러올 수 없습니다.
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>지표 비교</CardTitle>
            </CardHeader>
            <CardContent className="overflow-x-auto">
              <table className="w-full min-w-[640px] text-xs">
                <thead>
                  <tr className="border-b border-zinc-200 text-left text-zinc-500 dark:border-zinc-800">
                    <th className="py-2 pr-3 font-medium">종목</th>
                    <th className="py-2 pr-3 text-right font-medium">현재가</th>
                    <th className="py-2 pr-3 text-right font-medium">변동</th>
                    <th className="py-2 pr-3 text-right font-medium">고가</th>
                    <th className="py-2 pr-3 text-right font-medium">저가</th>
                    <th className="py-2 pr-3 text-right font-medium">거래량</th>
                    <th className="py-2 pr-3 text-right font-medium">시총</th>
                    <th className="py-2 text-right font-medium">기간 수익</th>
                  </tr>
                </thead>
                <tbody>
                  {tickerList.map((t, i) => {
                    const q = quotes[i];
                    const candles = histories[i];
                    const periodReturn =
                      candles.length >= 2
                        ? ((candles[candles.length - 1].close - candles[0].close) /
                            candles[0].close) *
                          100
                        : null;
                    if (!q) {
                      return (
                        <tr key={t} className="border-b border-zinc-100 dark:border-zinc-900">
                          <td className="py-2 pr-3 font-mono">{t}</td>
                          <td colSpan={7} className="py-2 text-right text-zinc-500">
                            데이터 없음
                          </td>
                        </tr>
                      );
                    }
                    return (
                      <tr key={t} className="border-b border-zinc-100 dark:border-zinc-900">
                        <td className="py-2 pr-3">
                          <Link
                            href={`/stocks/${encodeURIComponent(t)}`}
                            className="font-medium hover:underline"
                          >
                            {q.name}
                          </Link>
                          <div className="font-mono text-[10px] text-zinc-500">{q.ticker}</div>
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {formatCurrency(q.price, q.market)}
                        </td>
                        <td className="py-2 pr-3 text-right">
                          <span className={`rounded px-1.5 py-0.5 tabular-nums ${changeBg(q.change)}`}>
                            {formatPercent(q.changePercent)}
                          </span>
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {q.dayHigh != null ? formatCurrency(q.dayHigh, q.market) : "—"}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {q.dayLow != null ? formatCurrency(q.dayLow, q.market) : "—"}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {formatCompactNumber(q.volume, q.market)}
                        </td>
                        <td className="py-2 pr-3 text-right tabular-nums">
                          {q.marketCap != null ? formatCompactNumber(q.marketCap, q.market) : "—"}
                        </td>
                        <td className="py-2 text-right">
                          {periodReturn !== null ? (
                            <span
                              className={`rounded px-1.5 py-0.5 tabular-nums ${changeBg(periodReturn)}`}
                            >
                              {periodReturn > 0 ? "+" : ""}
                              {periodReturn.toFixed(2)}%
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
