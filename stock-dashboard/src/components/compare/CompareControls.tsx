"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Plus, X, Search } from "lucide-react";
import type { SearchResult } from "@/lib/stocks/search";
import { Button } from "@/components/ui/button";

interface CompareControlsProps {
  tickers: string[];
}

const RANGES: Array<{ value: string; label: string }> = [
  { value: "1mo", label: "1M" },
  { value: "3mo", label: "3M" },
  { value: "6mo", label: "6M" },
  { value: "1y", label: "1Y" },
  { value: "2y", label: "2Y" },
  { value: "5y", label: "5Y" },
];

export function CompareControls({ tickers }: CompareControlsProps) {
  const router = useRouter();
  const sp = useSearchParams();
  const range = sp.get("range") ?? "6mo";

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      return;
    }
    setLoading(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=6`, {
          signal: ctrl.signal,
        });
        const json = (await res.json()) as { results: SearchResult[] };
        setResults(json.results);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setResults([]);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const buildUrl = (newTickers: string[], newRange: string) => {
    const params = new URLSearchParams();
    if (newTickers.length > 0) params.set("tickers", newTickers.join(","));
    params.set("range", newRange);
    return `/compare?${params.toString()}`;
  };

  const addTicker = (ticker: string) => {
    const upper = ticker.trim().toUpperCase();
    if (!upper || tickers.includes(upper)) return;
    if (tickers.length >= 4) return;
    router.push(buildUrl([...tickers, upper], range));
    setQuery("");
    setOpen(false);
  };

  const removeTicker = (ticker: string) => {
    router.push(buildUrl(tickers.filter((t) => t !== ticker), range));
  };

  const setRange = (r: string) => {
    router.push(buildUrl(tickers, r));
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {tickers.map((t) => (
          <span
            key={t}
            className="inline-flex items-center gap-1 rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-medium dark:border-zinc-700 dark:bg-zinc-900"
          >
            {t}
            <button
              type="button"
              onClick={() => removeTicker(t)}
              className="text-zinc-400 transition-colors hover:text-rose-500"
              aria-label={`${t} 제거`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}

        <div ref={wrapRef} className="relative">
          {tickers.length < 4 ? (
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-zinc-400" />
              <input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setOpen(true);
                }}
                onFocus={() => setOpen(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    if (results[0]) addTicker(results[0].ticker);
                    else if (query.trim()) addTicker(query);
                  } else if (e.key === "Escape") setOpen(false);
                }}
                placeholder="종목 추가"
                className="h-7 w-44 rounded-full border border-dashed border-zinc-300 bg-transparent pl-6 pr-2 text-xs outline-none transition-colors focus:border-zinc-400 dark:border-zinc-700 dark:focus:border-zinc-500"
              />
            </div>
          ) : (
            <span className="text-xs text-zinc-500">최대 4개</span>
          )}
          {open && query.trim() && results.length > 0 ? (
            <div className="absolute left-0 top-full z-50 mt-1 w-72 overflow-hidden rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
              {loading ? (
                <div className="px-3 py-2 text-xs text-zinc-500">검색 중...</div>
              ) : null}
              {results.map((r) => (
                <button
                  key={r.symbol}
                  type="button"
                  onClick={() => addTicker(r.ticker)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs hover:bg-zinc-100 dark:hover:bg-zinc-900"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium">{r.name}</div>
                    <div className="text-[10px] text-zinc-500">{r.ticker} · {r.market}</div>
                  </div>
                  <Plus className="h-3 w-3 shrink-0 text-zinc-400" />
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex gap-1">
        {RANGES.map((r) => (
          <button
            key={r.value}
            type="button"
            onClick={() => setRange(r.value)}
            className={`rounded px-2 py-1 text-xs font-medium transition-colors ${
              r.value === range
                ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100"
                : "text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900"
            }`}
          >
            {r.label}
          </button>
        ))}
      </div>
    </div>
  );
}
