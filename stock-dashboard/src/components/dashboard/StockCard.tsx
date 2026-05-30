"use client";

import Link from "next/link";
import { Bell, BellOff, MoreVertical, X } from "lucide-react";
import type { Quote, WatchItem } from "@/types/stock";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { changeBg, formatCompactNumber, formatCurrency, formatPercent } from "@/lib/format";
import { toFullSymbol } from "@/lib/stocks/normalize";
import { SourceBadge } from "@/components/detail/SourceBadge";

interface StockCardProps {
  item: WatchItem;
  quote?: Quote;
  loading: boolean;
  onRemove: () => void;
  onOpenAlerts: () => void;
}

export function StockCard({ item, quote, loading, onRemove, onOpenAlerts }: StockCardProps) {
  const symbol = toFullSymbol(item.ticker, item.market);
  const displayName = quote?.name ?? item.name ?? item.ticker;
  const hasTargets = item.targetUp != null || item.targetDown != null;

  return (
    <Card className="group relative overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <Link
            href={`/stocks/${encodeURIComponent(symbol)}`}
            className="flex flex-col gap-1 hover:opacity-80"
          >
            <div className="flex items-center gap-2">
              <Badge tone={item.market === "KR" ? "info" : "default"}>{item.market}</Badge>
              <span className="text-xs font-mono text-zinc-500">{item.ticker}</span>
            </div>
            <h3 className="text-sm font-semibold leading-tight line-clamp-1">{displayName}</h3>
          </Link>
          <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onOpenAlerts}
              aria-label="알림 설정"
            >
              {hasTargets ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onRemove}
              aria-label="제거"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading && !quote ? (
          <div className="space-y-2">
            <div className="h-7 w-32 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
            <div className="h-4 w-20 animate-pulse rounded bg-zinc-100 dark:bg-zinc-800" />
          </div>
        ) : quote ? (
          <div className="space-y-2">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums">
                {formatCurrency(quote.price, quote.market)}
              </span>
              <SourceBadge source={quote.source} />
            </div>
            <div className="flex items-center gap-2">
              <span className={`rounded px-1.5 py-0.5 text-xs font-medium ${changeBg(quote.change)}`}>
                {formatPercent(quote.changePercent)}
              </span>
              <span className="text-xs text-zinc-500 tabular-nums">
                {quote.change >= 0 ? "+" : ""}
                {quote.market === "KR"
                  ? quote.change.toFixed(0)
                  : quote.change.toFixed(2)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-x-3 gap-y-1 pt-2 text-xs text-zinc-500">
              <div className="flex justify-between">
                <span>거래량</span>
                <span className="tabular-nums">{formatCompactNumber(quote.volume, quote.market)}</span>
              </div>
              {quote.dayHigh != null ? (
                <div className="flex justify-between">
                  <span>고가</span>
                  <span className="tabular-nums">{formatCurrency(quote.dayHigh, quote.market)}</span>
                </div>
              ) : null}
              {quote.marketCap != null ? (
                <div className="flex justify-between">
                  <span>시총</span>
                  <span className="tabular-nums">{formatCompactNumber(quote.marketCap, quote.market)}</span>
                </div>
              ) : null}
              {quote.dayLow != null ? (
                <div className="flex justify-between">
                  <span>저가</span>
                  <span className="tabular-nums">{formatCurrency(quote.dayLow, quote.market)}</span>
                </div>
              ) : null}
            </div>
            {hasTargets ? (
              <div className="flex gap-2 pt-2 text-xs">
                {item.targetUp != null ? (
                  <Badge tone="up">↑ {formatCurrency(item.targetUp, quote.market)}</Badge>
                ) : null}
                {item.targetDown != null ? (
                  <Badge tone="down">↓ {formatCurrency(item.targetDown, quote.market)}</Badge>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <MoreVertical className="h-4 w-4" /> 데이터 없음
          </div>
        )}
      </CardContent>
    </Card>
  );
}
