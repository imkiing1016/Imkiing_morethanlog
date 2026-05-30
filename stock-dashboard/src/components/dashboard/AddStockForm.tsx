"use client";

import { useState } from "react";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useWatchlist } from "@/stores/watchlist";

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

  // 종목 추가는 클라이언트에서 즉시 처리 (시세 카드의 배지가 실시간/샘플 여부를 알려줌)
  const quickAdd = (code: string) => {
    setError(null);
    const result = add(code);
    if (!result.ok && result.reason !== "이미 추가된 종목입니다") {
      setError(result.reason ?? "추가 실패");
    }
  };

  const submit = async (input: string) => {
    setError(null);
    const trimmed = input.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const result = add(trimmed);
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

  const addAllSuggestions = () => {
    setError(null);
    SUGGESTIONS.forEach((s) => add(s.code));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loading) submit(value);
  };

  const existing = new Set(items.map((i) => i.ticker.replace(/\.(KS|KQ)$/i, "")));

  return (
    <div className="space-y-2">
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="티커 추가 (예: AAPL, 005930, 000660)"
          className="max-w-xs"
          disabled={loading}
        />
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
