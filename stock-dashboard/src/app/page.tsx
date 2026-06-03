import { Suspense } from "react";
import { WatchlistGrid } from "@/components/dashboard/WatchlistGrid";
import { SentimentGauge } from "@/components/dashboard/SentimentGauge";
import { MarketOverview } from "@/components/dashboard/MarketOverview";
import { MarketSummaryCard } from "@/components/dashboard/MarketSummaryCard";
import { NewsList } from "@/components/dashboard/NewsList";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

function SectionFallback({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-24 animate-pulse rounded-md bg-zinc-100 dark:bg-zinc-900" />
      </CardContent>
    </Card>
  );
}

export default function HomePage() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 px-4 py-6">
      <Suspense fallback={<SectionFallback title="시장 개요" />}>
        <MarketOverview />
      </Suspense>

      <Suspense fallback={<SectionFallback title="오늘의 시장 요약" />}>
        <MarketSummaryCard />
      </Suspense>

      <section className="grid gap-4 lg:grid-cols-2">
        <SentimentGauge market="KR" />
        <SentimentGauge market="US" />
      </section>

      <WatchlistGrid />

      <Suspense fallback={<SectionFallback title="시장 뉴스" />}>
        <NewsList limit={8} aiSummary summaryLabel="국내 증시" />
      </Suspense>
    </div>
  );
}
