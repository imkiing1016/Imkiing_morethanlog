import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getHistory, getQuote } from "@/lib/stocks/provider";
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
import { BeginnerExplainCard } from "@/components/detail/BeginnerExplainCard";
import { AnalystReports } from "@/components/detail/AnalystReports";
import { NewsList } from "@/components/dashboard/NewsList";
import { Collapsible } from "@/components/ui/collapsible";

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

      <Suspense fallback={<div className="h-40 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />}>
        <BeginnerExplainCard quote={quote} candles={candles} ticker={quote.ticker} market={quote.market} />
      </Suspense>

      <Card>
        <CardHeader>
          <CardTitle>요약</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm sm:grid-cols-4">
            <div className="flex justify-between">
              <dt className="text-zinc-500">현재가</dt>
              <dd className="tabular-nums">{formatCurrency(quote.price, quote.market)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-zinc-500">전일 종가</dt>
              <dd className="tabular-nums">{formatCurrency(quote.previousClose, quote.market)}</dd>
            </div>
            {quote.dayHigh != null ? (
              <div className="flex justify-between">
                <dt className="text-zinc-500">당일 고가</dt>
                <dd className="tabular-nums">{formatCurrency(quote.dayHigh, quote.market)}</dd>
              </div>
            ) : null}
            {quote.dayLow != null ? (
              <div className="flex justify-between">
                <dt className="text-zinc-500">당일 저가</dt>
                <dd className="tabular-nums">{formatCurrency(quote.dayLow, quote.market)}</dd>
              </div>
            ) : null}
            <div className="flex justify-between">
              <dt className="text-zinc-500">거래량</dt>
              <dd className="tabular-nums">{formatCompactNumber(quote.volume, quote.market)}</dd>
            </div>
            {quote.marketCap != null ? (
              <div className="flex justify-between">
                <dt className="text-zinc-500">시가총액</dt>
                <dd className="tabular-nums">{formatCompactNumber(quote.marketCap, quote.market)}</dd>
              </div>
            ) : null}
          </dl>
        </CardContent>
      </Card>

      <Collapsible title="기술적 지표" subtitle="이동평균·RSI·MACD 차트">
        <IndicatorPanel candles={candles} />
      </Collapsible>

      <Collapsible title="펀더멘털" subtitle="PER·EPS·배당 등 재무 지표">
        <Suspense fallback={<div className="h-32 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />}>
          <FundamentalsCard ticker={quote.ticker} market={quote.market} />
        </Suspense>
      </Collapsible>

      <Collapsible title="애널리스트 리포트" subtitle="증권사 목표주가·리포트 (국내)" defaultOpen>
        <Suspense fallback={<div className="h-32 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />}>
          <AnalystReports ticker={quote.ticker} market={quote.market} currentPrice={quote.price} />
        </Suspense>
      </Collapsible>

      <Collapsible title="AI 분석 리포트" subtitle="차트·재무·뉴스 종합 (로컬 LLM)">
        <AIAnalysisPanel ticker={quote.ticker} market={quote.market} />
      </Collapsible>

      <Collapsible title={`${displayName} 관련 뉴스`} subtitle="최근 기사">
        <Suspense fallback={<div className="h-32 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-900" />}>
          <NewsList ticker={quote.ticker} title={`${displayName} 관련 뉴스`} limit={8} />
        </Suspense>
      </Collapsible>
    </div>
  );
}
