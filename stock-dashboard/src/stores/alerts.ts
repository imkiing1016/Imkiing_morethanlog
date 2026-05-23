"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

export interface TriggeredAlert {
  id: string;
  ticker: string;
  market: "KR" | "US";
  direction: "up" | "down";
  price: number;
  target: number;
  firedAt: number;
}

interface AlertsState {
  fired: TriggeredAlert[];
  notify: (alert: TriggeredAlert) => boolean;
  clear: () => void;
  dismiss: (id: string) => void;
}

const DEDUPE_WINDOW_MS = 1000 * 60 * 30;

export const useAlerts = create<AlertsState>()(
  persist(
    (set, get) => ({
      fired: [],
      notify: (alert) => {
        const recent = get().fired.find(
          (f) =>
            f.ticker === alert.ticker &&
            f.market === alert.market &&
            f.direction === alert.direction &&
            Date.now() - f.firedAt < DEDUPE_WINDOW_MS,
        );
        if (recent) return false;
        set({ fired: [alert, ...get().fired].slice(0, 50) });
        return true;
      },
      clear: () => set({ fired: [] }),
      dismiss: (id) => set({ fired: get().fired.filter((f) => f.id !== id) }),
    }),
    {
      name: "stockhub-alerts-v1",
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
