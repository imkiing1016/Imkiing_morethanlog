import { create } from "zustand";

// 디버그 로그 항목 하나. 화면 하단 패널에 표시된다.
export interface DebugEntry {
  id: number;
  timestamp: number;
  kind: "send" | "recv" | "status" | "error" | "note";
  text: string;
  detail?: string;
}

interface DebugStore {
  entries: DebugEntry[];
  open: boolean;
  push: (entry: Omit<DebugEntry, "id" | "timestamp">) => void;
  clear: () => void;
  setOpen: (open: boolean) => void;
}

let nextId = 1;
const MAX_ENTRIES = 100;

export const useDebugLog = create<DebugStore>((set) => ({
  entries: [],
  open: false,
  push: (entry) =>
    set((s) => {
      const next: DebugEntry = {
        id: nextId++,
        timestamp: Date.now(),
        ...entry,
      };
      const entries = [...s.entries, next];
      // 최근 100개만 유지 (오래된 것부터 삭제)
      if (entries.length > MAX_ENTRIES) entries.splice(0, entries.length - MAX_ENTRIES);
      return { entries };
    }),
  clear: () => set({ entries: [] }),
  setOpen: (open) => set({ open }),
}));

// 짧게 요약 문자열로.
export function summarize(obj: unknown, max = 120): string {
  try {
    const s = JSON.stringify(obj);
    return s.length > max ? s.slice(0, max) + "…" : s;
  } catch {
    return String(obj);
  }
}
