"use client";

import { useEffect, useRef, useState } from "react";
import { Bell, BellRing } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAlerts } from "@/stores/alerts";
import type { Quote, WatchItem } from "@/types/stock";
import { toYahooSymbol } from "@/lib/stocks/normalize";
import { formatCurrency } from "@/lib/format";

interface AlertMonitorProps {
  items: WatchItem[];
  quotes: Quote[];
}

type PermissionState = "default" | "granted" | "denied" | "unsupported";

export function AlertMonitor({ items, quotes }: AlertMonitorProps) {
  const [permission, setPermission] = useState<PermissionState>("default");
  const notify = useAlerts((s) => s.notify);
  const previousQuotes = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission as PermissionState);
  }, []);

  useEffect(() => {
    const quoteMap = new Map<string, Quote>();
    for (const q of quotes) {
      quoteMap.set(`${q.ticker}|${q.market}`, q);
    }
    for (const item of items) {
      const q = quoteMap.get(`${item.ticker}|${item.market}`);
      if (!q) continue;
      const key = toYahooSymbol(item.ticker, item.market);
      const prev = previousQuotes.current.get(key);
      previousQuotes.current.set(key, q.price);

      if (item.targetUp != null) {
        const crossed =
          q.price >= item.targetUp && (prev == null || prev < item.targetUp);
        if (crossed) fire(item, q, "up", item.targetUp);
      }
      if (item.targetDown != null) {
        const crossed =
          q.price <= item.targetDown && (prev == null || prev > item.targetDown);
        if (crossed) fire(item, q, "down", item.targetDown);
      }
    }

    function fire(item: WatchItem, q: Quote, direction: "up" | "down", target: number) {
      const fresh = notify({
        id: `${item.ticker}-${item.market}-${direction}-${Date.now()}`,
        ticker: item.ticker,
        market: item.market,
        direction,
        price: q.price,
        target,
        firedAt: Date.now(),
      });
      if (!fresh) return;
      if (typeof window !== "undefined" && Notification.permission === "granted") {
        const title = `${item.ticker} ${direction === "up" ? "▲ 상승 목표 도달" : "▼ 하락 목표 도달"}`;
        const body = `현재가 ${formatCurrency(q.price, q.market)} (목표 ${formatCurrency(target, q.market)})`;
        new Notification(title, { body, tag: `${item.ticker}-${direction}` });
      }
    }
  }, [items, quotes, notify]);

  const request = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermission(result as PermissionState);
  };

  if (permission === "granted") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-emerald-500">
        <BellRing className="h-3.5 w-3.5" /> 알림 활성화됨
      </div>
    );
  }
  if (permission === "unsupported") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
        <Bell className="h-3.5 w-3.5" /> 브라우저 알림 미지원
      </div>
    );
  }
  if (permission === "denied") {
    return (
      <div className="flex items-center gap-1.5 text-xs text-zinc-400">
        <Bell className="h-3.5 w-3.5" /> 알림 차단됨 (브라우저 설정에서 허용 필요)
      </div>
    );
  }
  return (
    <Button onClick={request} variant="outline" size="sm">
      <Bell className="h-3.5 w-3.5" /> 알림 허용
    </Button>
  );
}
