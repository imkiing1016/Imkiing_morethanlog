export type Market = "KR" | "US";

export function formatPrice(value: number, market: Market): string {
  if (market === "KR") {
    return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 0 }).format(value);
  }
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatCurrency(value: number, market: Market): string {
  const formatted = formatPrice(value, market);
  return market === "KR" ? `₩${formatted}` : `$${formatted}`;
}

export function formatPercent(value: number, digits = 2): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(digits)}%`;
}

export function formatCompactNumber(value: number, market: Market): string {
  const locale = market === "KR" ? "ko-KR" : "en-US";
  return new Intl.NumberFormat(locale, {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

export function changeColor(change: number): string {
  if (change > 0) return "text-emerald-500";
  if (change < 0) return "text-rose-500";
  return "text-zinc-400";
}

export function changeBg(change: number): string {
  if (change > 0) return "bg-emerald-500/10 text-emerald-500";
  if (change < 0) return "bg-rose-500/10 text-rose-500";
  return "bg-zinc-500/10 text-zinc-400";
}
