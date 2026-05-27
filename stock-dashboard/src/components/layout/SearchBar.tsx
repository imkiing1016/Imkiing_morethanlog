"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import type { SearchResult } from "@/lib/stocks/search";

export function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 1) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=8`, {
          signal: ctrl.signal,
        });
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as { results: SearchResult[] };
        setResults(json.results);
        setActive(0);
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setResults([]);
        }
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

  const goto = (r: SearchResult) => {
    const path = `/stocks/${encodeURIComponent(r.ticker)}`;
    router.push(path);
    setQuery("");
    setOpen(false);
    setResults([]);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) goto(results[active]);
      else if (query.trim()) {
        router.push(`/stocks/${encodeURIComponent(query.trim().toUpperCase())}`);
        setQuery("");
        setOpen(false);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="종목 검색 (예: Apple, 005930, 삼성전자)"
          className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-8 pr-8 text-xs outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 dark:border-zinc-800 dark:bg-zinc-950 dark:placeholder:text-zinc-600 dark:focus:border-zinc-600"
          aria-label="종목 검색"
        />
        {loading ? (
          <Loader2 className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-zinc-400" />
        ) : null}
      </div>
      {open && (results.length > 0 || (query.trim() && !loading)) ? (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
          {results.length === 0 ? (
            <div className="px-3 py-2 text-xs text-zinc-500">검색 결과 없음 (Enter로 직접 이동)</div>
          ) : (
            results.map((r, i) => (
              <button
                key={`${r.symbol}-${i}`}
                type="button"
                onClick={() => goto(r)}
                onMouseEnter={() => setActive(i)}
                className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors ${
                  i === active
                    ? "bg-zinc-100 dark:bg-zinc-900"
                    : "hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium">{r.name}</div>
                  <div className="truncate text-[10px] text-zinc-500">
                    {r.ticker} · {r.exchange ?? r.market} · {r.type ?? "Equity"}
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${
                    r.market === "KR"
                      ? "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300"
                      : "bg-zinc-100 text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300"
                  }`}
                >
                  {r.market}
                </span>
              </button>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}
