import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getHistory, getQuote } from "@/lib/stocks/yahoo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { changeBg, formatCompactNumber, formatCurrency, formatPercent } from "@/lib/format";
import { displayTicker } from "@/lib/stocks/normalize";
import { Suspense } from "react";
import { PriceChart } from "@/components/detail/PriceChart";
import { IndicatorPanel } from "@/components/detail/IndicatorPanel";
import { AIAnalysisPanel } from "@/components/detail/AIAnalysisPanel";
import { FundamentalsCard } from "@/components/detail/FundamentalsCard";
import { SourceBadge } from "@/components/detail/SourceBadge";
import { NewsList } from "@/components/dashboard/NewsList";

interface PageProps {
  params: Promise<{ ticker: string }>;
  searchParams: Promise<{ range?: string }>;
}

export default async function StockDetailPage({ params, searchParams }: PageProps) {
  const { ticker } = await params;
  const sp = await searchParams;
  const decoded = decodeURIComponent(ticker);
  const range =
    sp.range && ["1mo", "3mo", "6mo", "1y", "2y", "5y", "max"].includes(sp.range)
      ? (sp.range as "1mo" | "3mo" | "6mo" | "1y" | "2y" | "5y" | "max")
      : "6mo";
  const [quote, candles] = await Promise.all([
    getQuote(decoded),
    getHistory(decoded, range),
  ]);
  const displayName = quote.name ?? displayTicker(decoded);
  const isKr = quote.market === "KR";

  const RANGES: Array<{ value: typeof range; label: string }> = [
    { value: "1mo", label: "1M" },
    { value: "3mo", label: "3M" },
    { value: "6mo", label: "6M" },
    { value: "1y", label: "1Y" },
    { value: "2y", label: "2Y" },
    { value: "5y", label: "5Y" },
  ];

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

      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone={isKr ? "info" : "default"}>{quote.market}</Badge>
            <span className="font-mono text-sm text-zinc-500">{quote.ticker}</span>
            <SourceBadge source={quote.source} />
          </div>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">{displayName}</h1>
        </div>
        <div className="flex items-baseline gap-3">
          <span className="text-3xl font-bold tabular-nums">
            {formatCurrency(quote.price, quote.market)}
          </span>
          <span className={`rounded px-2 py-0.5 text-sm font-medium ${changeBg(quote.change)}`}>
            {formatPercent(quote.changePercent)}
          </span>
          <span className="text-sm text-zinc-500 tabular-nums">
            {quote.change >= 0 ? "+" : ""}
            {isKr ? quote.change.toFixed(0) : quote.change.toFixed(2)}
          </span>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>가격 차트</CardTitle>
            <p className="text-xs text-zinc-500">캔들 + 이동평균선(MA20/60/120) + 거래량</p>
          </div>
          <div className="flex gap-1">
            {RANGES.map((r) => (
              <Link
                key={r.value}
                href={`/stocks/${encodeURIComponent(decoded)}?range=${r.value}`}
                className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
                  r.value === range
                    ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                    : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
                }`}
              >
                {r.label}
              </Link>
            ))}
          </div>
        </CardHeader>
        <CardContent>
          <PriceChart candles={candles} isKr={isKr} />
        </CardContent>
      </Card>

      <IndicatorPanel candles={candles} />

      <Suspense fallback={<div className="h-32 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />}>
        <FundamentalsCard ticker={quote.ticker} market={quote.market} />
      </Suspense>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>요약</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-y-2 text-sm">
              <dt className="text-zinc-500">현재가</dt>
              <dd className="text-right tabular-nums">{formatCurrency(quote.price, quote.market)}</dd>
              <dt className="text-zinc-500">전일 종가</dt>
              <dd className="text-right tabular-nums">
                {formatCurrency(quote.previousClose, quote.market)}
              </dd>
              {quote.dayHigh != null ? (
                <>
                  <dt className="text-zinc-500">당일 고가</dt>
                  <dd className="text-right tabular-nums">
                    {formatCurrency(quote.dayHigh, quote.market)}
                  </dd>
                </>
              ) : null}
              {quote.dayLow != null ? (
                <>
                  <dt className="text-zinc-500">당일 저가</dt>
                  <dd className="text-right tabular-nums">
                    {formatCurrency(quote.dayLow, quote.market)}
                  </dd>
                </>
              ) : null}
              <dt className="text-zinc-500">거래량</dt>
              <dd className="text-right tabular-nums">
                {formatCompactNumber(quote.volume, quote.market)}
              </dd>
              {quote.marketCap != null ? (
                <>
                  <dt className="text-zinc-500">시가총액</dt>
                  <dd className="text-right tabular-nums">
                    {formatCompactNumber(quote.marketCap, quote.market)}
                  </dd>
                </>
              ) : null}
              <dt className="text-zinc-500">통화</dt>
              <dd className="text-right">{quote.currency}</dd>
            </dl>
          </CardContent>
        </Card>
        <div className="lg:col-span-2">
          <AIAnalysisPanel ticker={quote.ticker} market={quote.market} />
        </div>
      </div>

      <Suspense fallback={<div className="h-32 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />}>
        <NewsList ticker={quote.ticker} title={`${displayName} 관련 뉴스`} limit={8} />
      </Suspense>
    </div>
  );
}
