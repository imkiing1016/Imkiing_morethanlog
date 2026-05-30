"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Plus, Sparkles, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWatchlist } from "@/stores/watchlist";
import type { SearchResult } from "@/lib/stocks/search";

// 빠른 추가 (대표 국내/미국 종목)
const SUGGESTIONS: Array<{ code: string; label: string }> = [
  { code: "005930", label: "삼성전자" },
  { code: "000660", label: "SK하이닉스" },
  { code: "005380", label: "현대차" },
  { code: "035420", label: "NAVER" },
  { code: "035720", label: "카카오" },
  { code: "000270", label: "기아" },
  { code: "373220", label: "LG에너지솔루션" },
  { code: "207940", label: "삼성바이오로직스" },
  { code: "AAPL", label: "Apple" },
  { code: "NVDA", label: "NVIDIA" },
  { code: "TSLA", label: "Tesla" },
  { code: "MSFT", label: "Microsoft" },
];

export function AddStockForm() {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const add = useWatchlist((s) => s.add);
  const items = useWatchlist((s) => s.items);

  // 자동완성
  const [results, setResults] = useState<SearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 입력 변화 → 디바운스 검색
  useEffect(() => {
    const q = value.trim();
    if (q.length < 1) {
      setResults([]);
      setSearching(false);
      return;
    }
    setSearching(true);
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&limit=8`, {
          signal: ctrl.signal,
        });
        const json = (await res.json()) as { results: SearchResult[] };
        setResults(json.results);
        setActive(0);
      } catch (err) {
        if ((err as Error).name !== "AbortError") setResults([]);
      } finally {
        if (!ctrl.signal.aborted) setSearching(false);
      }
    }, 200);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [value]);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const addResult = (r: SearchResult) => {
    setError(null);
    const result = add(r.ticker, r.name);
    if (!result.ok && result.reason !== "이미 추가된 종목입니다") {
      setError(result.reason ?? "추가 실패");
      return;
    }
    setValue("");
    setResults([]);
    setOpen(false);
  };

  const quickAdd = (code: string) => {
    setError(null);
    const result = add(code);
    if (!result.ok && result.reason !== "이미 추가된 종목입니다") {
      setError(result.reason ?? "추가 실패");
    }
  };

  // Enter/버튼: 선택된 결과 우선, 없으면 검색 해석 후 추가
  const submit = async () => {
    setError(null);
    const trimmed = value.trim();
    if (!trimmed) return;
    if (results[active]) {
      addResult(results[active]);
      return;
    }
    setLoading(true);
    try {
      let toAdd = trimmed;
      let name: string | undefined;
      const looksLikeCode =
        /^\d{6}(\.[A-Z]{2})?$/i.test(trimmed) || /^[A-Za-z][A-Za-z.\-]{0,9}$/.test(trimmed);
      if (!looksLikeCode) {
        const res = await fetch(`/api/search?q=${encodeURIComponent(trimmed)}&limit=1`, {
          cache: "no-store",
        });
        const json = (await res.json()) as { results?: SearchResult[] };
        const top = json.results?.[0];
        if (!top) {
          setError("종목을 찾을 수 없습니다");
          return;
        }
        toAdd = top.ticker;
        name = top.name;
      }
      const result = add(toAdd, name);
      if (!result.ok) {
        setError(result.reason ?? "추가 실패");
        return;
      }
      setValue("");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (!loading) submit();
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  const addAllSuggestions = () => {
    setError(null);
    SUGGESTIONS.forEach((s) => add(s.code));
  };

  const onFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loading) submit();
  };

  const existing = new Set(items.map((i) => i.ticker.replace(/\.(KS|KQ)$/i, "")));

  return (
    <div className="space-y-2">
      <form onSubmit={onFormSubmit} className="flex items-center gap-2">
        <div ref={wrapRef} className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
          <input
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={onKeyDown}
            placeholder="종목 검색·추가 (예: 넥슨, 005930, AAPL)"
            disabled={loading}
            className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-8 pr-8 text-xs outline-none transition-colors placeholder:text-zinc-400 focus:border-zinc-400 disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:placeholder:text-zinc-600 dark:focus:border-zinc-600"
            aria-label="종목 검색·추가"
          />
          {searching ? (
            <Loader2 className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-zinc-400" />
          ) : null}
          {open && value.trim() && results.length > 0 ? (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
              {results.map((r, i) => {
                const added = existing.has(r.ticker.replace(/\.(KS|KQ)$/i, ""));
                return (
                  <button
                    key={`${r.symbol}-${i}`}
                    type="button"
                    onClick={() => addResult(r)}
                    onMouseEnter={() => setActive(i)}
                    disabled={added}
                    className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors disabled:opacity-40 ${
                      i === active ? "bg-zinc-100 dark:bg-zinc-900" : "hover:bg-zinc-50 dark:hover:bg-zinc-900/60"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium">{r.name}</div>
                      <div className="truncate text-[10px] text-zinc-500">
                        {r.ticker} · {r.exchange ?? r.market}
                      </div>
                    </div>
                    {added ? (
                      <span className="shrink-0 text-[10px] text-zinc-400">추가됨</span>
                    ) : (
                      <Plus className="h-3.5 w-3.5 shrink-0 text-zinc-400" />
                    )}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        <Button type="submit" variant="primary" size="sm" disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          추가
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={addAllSuggestions}>
          <Sparkles className="h-3.5 w-3.5" />
          대표 종목 모두 추가
        </Button>
      </form>
      {error ? <p className="text-xs text-rose-500">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-zinc-400">빠른 추가:</span>
        {SUGGESTIONS.map((s) => {
          const added = existing.has(s.code);
          return (
            <button
              key={s.code}
              type="button"
              onClick={() => quickAdd(s.code)}
              disabled={added}
              className="rounded-full border border-zinc-200 px-2 py-0.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-40 dark:border-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
              title={added ? "이미 추가됨" : `${s.label} 추가`}
            >
              {s.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
