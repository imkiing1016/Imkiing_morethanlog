"use client";

import { useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useWatchlist } from "@/stores/watchlist";

const SUGGESTIONS = ["AAPL", "TSLA", "NVDA", "GOOGL", "005930", "000660", "035420"];

export function AddStockForm() {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const add = useWatchlist((s) => s.add);

  const submit = async (input: string) => {
    setError(null);
    const trimmed = input.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/validate/${encodeURIComponent(trimmed)}`, {
        cache: "no-store",
      });
      const data = (await res.json()) as { valid: boolean; reason?: string };
      if (!data.valid) {
        setError(data.reason ?? "유효하지 않은 티커입니다");
        return;
      }
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

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!loading) submit(value);
  };

  return (
    <div className="space-y-2">
      <form onSubmit={onSubmit} className="flex items-center gap-2">
        <Input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="티커 추가 (예: AAPL, 005930)"
          className="max-w-xs"
          disabled={loading}
        />
        <Button type="submit" variant="primary" size="sm" disabled={loading}>
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
          추가
        </Button>
      </form>
      {error ? <p className="text-xs text-rose-500">{error}</p> : null}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-xs text-zinc-400">빠른 추가:</span>
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => submit(s)}
            disabled={loading}
            className="rounded-full border border-zinc-200 px-2 py-0.5 text-xs text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 disabled:opacity-50 dark:border-zinc-800 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
