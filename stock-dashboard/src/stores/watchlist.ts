"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { Market, WatchItem } from "@/types/stock";
import { normalizeInput } from "@/lib/stocks/normalize";

interface WatchlistState {
  items: WatchItem[];
  hydrated: boolean;
  add: (input: string, name?: string) => { ok: boolean; reason?: string };
  remove: (ticker: string, market: Market) => void;
  rename: (ticker: string, market: Market, name: string) => void;
  setTargets: (
    ticker: string,
    market: Market,
    targets: { up?: number | null; down?: number | null },
  ) => void;
  setHydrated: () => void;
}

const DEFAULTS: WatchItem[] = [
  { ticker: "AAPL", market: "US", name: "Apple Inc.", addedAt: Date.now() },
  { ticker: "NVDA", market: "US", name: "NVIDIA Corporation", addedAt: Date.now() },
  { ticker: "005930", market: "KR", name: "삼성전자", addedAt: Date.now() },
];

export const useWatchlist = create<WatchlistState>()(
  persist(
    (set, get) => ({
      items: DEFAULTS,
      hydrated: false,
      add: (input, name) => {
        if (!input.trim()) return { ok: false, reason: "티커를 입력하세요" };
        try {
          const { ticker, market } = normalizeInput(input);
          const exists = get().items.some(
            (i) => i.ticker === ticker && i.market === market,
          );
          if (exists) return { ok: false, reason: "이미 추가된 종목입니다" };
          set({
            items: [
              ...get().items,
              { ticker, market, name, addedAt: Date.now() },
            ],
          });
          return { ok: true };
        } catch (err) {
          return { ok: false, reason: (err as Error).message };
        }
      },
      remove: (ticker, market) =>
        set({ items: get().items.filter((i) => !(i.ticker === ticker && i.market === market)) }),
      rename: (ticker, market, name) =>
        set({
          items: get().items.map((i) =>
            i.ticker === ticker && i.market === market ? { ...i, name } : i,
          ),
        }),
      setTargets: (ticker, market, targets) =>
        set({
          items: get().items.map((i) => {
            if (i.ticker !== ticker || i.market !== market) return i;
            return {
              ...i,
              targetUp: targets.up === null ? undefined : targets.up ?? i.targetUp,
              targetDown: targets.down === null ? undefined : targets.down ?? i.targetDown,
            };
          }),
        }),
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: "stockhub-watchlist-v1",
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);
