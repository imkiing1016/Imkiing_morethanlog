import { TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getMarketIndices } from "@/lib/stocks/markets";
import { changeBg, formatPercent } from "@/lib/format";

function fmtPrice(value: number, region: "KR" | "US" | "FX"): string {
  if (region === "FX") {
    return new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 2 }).format(value);
  }
  return new Intl.NumberFormat(region === "KR" ? "ko-KR" : "en-US", {
    maximumFractionDigits: 2,
  }).format(value);
}

export async function MarketOverview() {
  const indices = await getMarketIndices();

  if (indices.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>시장 개요</span>
          <span className="text-[10px] font-normal text-zinc-500">주요 지수 · 환율</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {indices.map((idx) => {
            const Icon =
              idx.change > 0 ? TrendingUp : idx.change < 0 ? TrendingDown : Minus;
            return (
              <div
                key={idx.symbol}
                className="rounded-lg border border-zinc-200 bg-white/40 p-3 dark:border-zinc-800 dark:bg-zinc-950/40"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium uppercase tracking-wide text-zinc-500">
                    {idx.name}
                  </span>
                  <Icon
                    className={`h-3 w-3 ${
                      idx.change > 0
                        ? "text-emerald-500"
                        : idx.change < 0
                          ? "text-rose-500"
                          : "text-zinc-400"
                    }`}
                  />
                </div>
                <div className="mt-1 text-base font-semibold tabular-nums">
                  {fmtPrice(idx.price, idx.region)}
                </div>
                <div
                  className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] tabular-nums ${changeBg(idx.change)}`}
                >
                  {formatPercent(idx.changePercent)}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
