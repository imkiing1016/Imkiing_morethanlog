import type { QuoteSource } from "@/types/stock";

const LABELS: Record<QuoteSource, { text: string; cls: string }> = {
  naver: {
    text: "실시간 · 네이버",
    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
  },
  yahoo: {
    text: "실시간 · Yahoo",
    cls: "bg-violet-100 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300",
  },
  mock: {
    text: "샘플 데이터",
    cls: "bg-amber-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
  },
};

export function SourceBadge({ source }: { source?: QuoteSource }) {
  if (!source) return null;
  const { text, cls } = LABELS[source];
  return (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${cls}`} title="데이터 출처">
      {text}
    </span>
  );
}
