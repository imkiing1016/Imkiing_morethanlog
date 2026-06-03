"use client";

import { useState } from "react";
import { useWatchlist } from "@/stores/watchlist";
import { useQuotes } from "@/hooks/useQuotes";
import { StockCard } from "./StockCard";
import { AlertDialog } from "./AlertDialog";
import { AlertMonitor } from "./AlertMonitor";
import { AddStockForm } from "./AddStockForm";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import type { WatchItem } from "@/types/stock";

export function WatchlistGrid() {
  const items = useWatchlist((s) => s.items);
  const hydrated = useWatchlist((s) => s.hydrated);
  const remove = useWatchlist((s) => s.remove);
  const { quotes, loading, refresh, refreshedAt, error } = useQuotes(items, hydrated);
  const [alertTarget, setAlertTarget] = useState<WatchItem | null>(null);

  const quoteByKey = new Map(quotes.map((q) => [`${q.ticker}|${q.market}`, q]));
  const targetQuote = alertTarget
    ? quoteByKey.get(`${alertTarget.ticker}|${alertTarget.market}`)
    : undefined;

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold">관심 종목</h2>
          <p className="text-xs text-zinc-500">
            30초마다 자동 갱신
            {refreshedAt
              ? ` · 마지막 업데이트 ${new Date(refreshedAt).toLocaleTimeString()}`
              : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <AlertMonitor items={items} quotes={quotes} />
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            새로고침
          </Button>
        </div>
      </div>

      <AddStockForm />

      {error ? (
        <p className="text-xs text-rose-500">데이터 로드 실패: {error}</p>
      ) : null}

      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-10 text-center text-sm text-zinc-500 dark:border-zinc-700">
          관심 종목을 추가하세요.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((item) => (
            <StockCard
              key={`${item.ticker}-${item.market}`}
              item={item}
              quote={quoteByKey.get(`${item.ticker}|${item.market}`)}
              loading={loading}
              onRemove={() => remove(item.ticker, item.market)}
              onOpenAlerts={() => setAlertTarget(item)}
            />
          ))}
        </div>
      )}

      <AlertDialog
        item={alertTarget}
        onClose={() => setAlertTarget(null)}
        currentPrice={targetQuote?.price}
      />
    </section>
  );
}
