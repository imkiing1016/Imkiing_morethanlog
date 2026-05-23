"use client";

import { useEffect, useRef, useState } from "react";
import type { Quote, WatchItem } from "@/types/stock";
import { toYahooSymbol } from "@/lib/stocks/normalize";

const REFRESH_MS = 30_000;

interface UseQuotesState {
  quotes: Quote[];
  loading: boolean;
  error: string | null;
  refreshedAt: number | null;
}

export function useQuotes(items: WatchItem[], enabled = true): UseQuotesState & { refresh: () => void } {
  const [state, setState] = useState<UseQuotesState>({
    quotes: [],
    loading: items.length > 0,
    error: null,
    refreshedAt: null,
  });
  const mounted = useRef(true);
  const symbolsKey = items.map((i) => toYahooSymbol(i.ticker, i.market)).sort().join(",");

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    if (!enabled || items.length === 0) {
      setState((s) => ({ ...s, quotes: [], loading: false }));
      return;
    }
    let cancelled = false;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const load = async () => {
      if (typeof document !== "undefined" && document.hidden) return;
      try {
        const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(symbolsKey)}`, {
          cache: "no-store",
        });
        if (!res.ok) throw new Error(`status ${res.status}`);
        const json = (await res.json()) as { quotes: Quote[] };
        if (!cancelled && mounted.current) {
          setState({
            quotes: json.quotes,
            loading: false,
            error: null,
            refreshedAt: Date.now(),
          });
        }
      } catch (err) {
        if (!cancelled && mounted.current) {
          setState((s) => ({ ...s, loading: false, error: (err as Error).message }));
        }
      }
    };

    const start = () => {
      if (intervalId) return;
      load();
      intervalId = setInterval(load, REFRESH_MS);
    };
    const stop = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
    const onVis = () => (document.hidden ? stop() : start());

    start();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [symbolsKey, enabled, items.length]);

  const refresh = () => {
    setState((s) => ({ ...s, loading: true }));
    fetch(`/api/quotes?symbols=${encodeURIComponent(symbolsKey)}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((json: { quotes: Quote[] }) => {
        if (!mounted.current) return;
        setState({ quotes: json.quotes, loading: false, error: null, refreshedAt: Date.now() });
      })
      .catch((err) => {
        if (!mounted.current) return;
        setState((s) => ({ ...s, loading: false, error: (err as Error).message }));
      });
  };

  return { ...state, refresh };
}
