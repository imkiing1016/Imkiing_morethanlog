import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getFundamentals } from "@/lib/stocks/fundamentals";
import { formatCompactNumber, formatCurrency } from "@/lib/format";
import type { Market } from "@/types/stock";

interface FundamentalsCardProps {
  ticker: string;
  market: Market;
}

function fmtNum(v?: number, digits = 2): string {
  if (v == null || !isFinite(v)) return "—";
  return v.toFixed(digits);
}

function fmtPct(v?: number, digits = 2): string {
  if (v == null || !isFinite(v)) return "—";
  return `${(v * 100).toFixed(digits)}%`;
}

export async function FundamentalsCard({ ticker, market }: FundamentalsCardProps) {
  const f = await getFundamentals(ticker);

  const rows: Array<[string, string, string?]> = [
    ["P/E (TTM)", fmtNum(f.peRatio)],
    ["Forward P/E", fmtNum(f.forwardPe)],
    ["P/B", fmtNum(f.pbRatio)],
    ["EPS (TTM)", fmtNum(f.eps)],
    ["Forward EPS", fmtNum(f.forwardEps)],
    ["배당 수익률", fmtPct(f.dividendYield)],
    ["배당금", f.dividendRate != null ? formatCurrency(f.dividendRate, market) : "—"],
    ["배당 성향", fmtPct(f.payoutRatio)],
    ["베타 (β)", fmtNum(f.beta)],
    ["ROE", fmtPct(f.roe)],
    ["순이익률", fmtPct(f.profitMargin)],
    ["매출 성장률", fmtPct(f.revenueGrowth)],
    ["이익 성장률", fmtPct(f.earningsGrowth)],
    ["부채비율 (D/E)", fmtNum(f.debtToEquity, 1)],
    ["유동비율", fmtNum(f.currentRatio)],
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>펀더멘털</span>
          <span className="text-[10px] font-normal text-zinc-500">
            {f.source === "yahoo" ? "Yahoo Finance" : "샘플 데이터"}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:grid-cols-3">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between">
              <dt className="text-zinc-500">{label}</dt>
              <dd className="tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800 sm:grid-cols-4">
          <div>
            <div className="text-[10px] text-zinc-500">52주 최고</div>
            <div className="text-sm tabular-nums">
              {f.fiftyTwoWeekHigh != null ? formatCurrency(f.fiftyTwoWeekHigh, market) : "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-500">52주 최저</div>
            <div className="text-sm tabular-nums">
              {f.fiftyTwoWeekLow != null ? formatCurrency(f.fiftyTwoWeekLow, market) : "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-500">50일 평균</div>
            <div className="text-sm tabular-nums">
              {f.fiftyDayAvg != null ? formatCurrency(f.fiftyDayAvg, market) : "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-500">200일 평균</div>
            <div className="text-sm tabular-nums">
              {f.twoHundredDayAvg != null ? formatCurrency(f.twoHundredDayAvg, market) : "—"}
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800 sm:grid-cols-3">
          <div>
            <div className="text-[10px] text-zinc-500">매출 (TTM)</div>
            <div className="text-sm tabular-nums">
              {f.totalRevenue != null ? formatCompactNumber(f.totalRevenue, market) : "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-500">잉여현금흐름</div>
            <div className="text-sm tabular-nums">
              {f.freeCashflow != null ? formatCompactNumber(f.freeCashflow, market) : "—"}
            </div>
          </div>
          <div>
            <div className="text-[10px] text-zinc-500">총부채</div>
            <div className="text-sm tabular-nums">
              {f.totalDebt != null ? formatCompactNumber(f.totalDebt, market) : "—"}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
