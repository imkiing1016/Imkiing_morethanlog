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

  // 네이버 제공 지표를 앞쪽에, 미제공(확장 예정) 지표는 값이 있을 때만 노출
  const rows: Array<[string, string]> = [
    ["PER", fmtNum(f.peRatio)],
    ["PBR", fmtNum(f.pbRatio)],
    ["EPS", fmtNum(f.eps)],
    ["BPS", fmtNum(f.bps)],
    ["배당 수익률", fmtPct(f.dividendYield)],
    ["배당금", f.dividendRate != null ? formatCurrency(f.dividendRate, market) : "—"],
  ];
  if (f.roe != null) rows.push(["ROE", fmtPct(f.roe)]);
  if (f.profitMargin != null) rows.push(["순이익률", fmtPct(f.profitMargin)]);
  if (f.revenueGrowth != null) rows.push(["매출 성장률", fmtPct(f.revenueGrowth)]);
  if (f.debtToEquity != null) rows.push(["부채비율 (D/E)", fmtNum(f.debtToEquity, 1)]);

  const has52w = f.fiftyTwoWeekHigh != null || f.fiftyTwoWeekLow != null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>펀더멘털</span>
          <span className="text-[10px] font-normal text-zinc-500">
            {f.source === "naver" ? "네이버 금융" : "샘플 데이터"}
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

        {has52w || f.marketCap != null ? (
          <div className="mt-4 grid grid-cols-2 gap-3 border-t border-zinc-200 pt-3 dark:border-zinc-800 sm:grid-cols-3">
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
              <div className="text-[10px] text-zinc-500">시가총액</div>
              <div className="text-sm tabular-nums">
                {f.marketCap != null ? formatCompactNumber(f.marketCap, market) : "—"}
              </div>
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
