import { Users } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getKrIntegration } from "@/lib/stocks/kr-integration";
import type { Market } from "@/types/stock";

interface SupplyTrendCardProps {
  ticker: string;
  market: Market;
}

function fmtQty(n: number): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  const abs = Math.abs(n);
  const v =
    abs >= 1e8
      ? `${(abs / 1e8).toFixed(1)}억`
      : abs >= 1e4
        ? `${(abs / 1e4).toFixed(0)}만`
        : abs.toLocaleString();
  return `${sign}${v}`;
}

function cell(n: number) {
  const cls = n > 0 ? "text-emerald-500" : n < 0 ? "text-rose-500" : "text-zinc-400";
  return <span className={`tabular-nums ${cls}`}>{fmtQty(n)}</span>;
}

function fmtDate(d: string): string {
  if (d.length === 8) return `${d.slice(4, 6)}/${d.slice(6, 8)}`;
  return d;
}

export async function SupplyTrendCard({ ticker, market }: SupplyTrendCardProps) {
  if (market !== "KR") return null;
  const kr = await getKrIntegration(ticker).catch(() => null);
  const supply = kr?.supply ?? [];
  if (supply.length === 0) return null;

  // 최근 5일 외국인/기관 합산 (스마트머니)
  const recent5 = supply.slice(0, 5);
  const foreignNet = recent5.reduce((a, d) => a + d.foreigner, 0);
  const organNet = recent5.reduce((a, d) => a + d.organ, 0);
  const smartNet = foreignNet + organNet;
  const verdict =
    smartNet > 0
      ? { text: "외국인·기관 순매수 우위 (수급 우호적)", cls: "text-emerald-600 dark:text-emerald-400" }
      : smartNet < 0
        ? { text: "외국인·기관 순매도 우위 (수급 부담)", cls: "text-rose-600 dark:text-rose-400" }
        : { text: "수급 중립", cls: "text-zinc-500" };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2">
          <Users className="h-4 w-4 text-violet-500" /> 투자자별 매매동향
        </CardTitle>
        <p className="text-xs text-zinc-500">일별 순매수 수량 (외국인·기관이 사면 보통 수급 우호적)</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-lg border border-zinc-200 px-3 py-2 text-xs dark:border-zinc-800">
          <span className="text-zinc-500">최근 5일 합계 · </span>
          <span className={`font-semibold ${verdict.cls}`}>{verdict.text}</span>
          <div className="mt-1 flex gap-4 text-[11px] text-zinc-500">
            <span>외국인 {cell(foreignNet)}</span>
            <span>기관 {cell(organNet)}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[360px] text-xs">
            <thead>
              <tr className="border-b border-zinc-200 text-zinc-500 dark:border-zinc-800">
                <th className="py-1.5 pr-2 text-left font-medium">날짜</th>
                <th className="py-1.5 pr-2 text-right font-medium">외국인</th>
                <th className="py-1.5 pr-2 text-right font-medium">기관</th>
                <th className="py-1.5 pr-2 text-right font-medium">개인</th>
                <th className="py-1.5 text-right font-medium">외인보유</th>
              </tr>
            </thead>
            <tbody>
              {supply.slice(0, 7).map((d) => (
                <tr key={d.date} className="border-b border-zinc-100 dark:border-zinc-900">
                  <td className="py-1.5 pr-2 text-left tabular-nums text-zinc-500">{fmtDate(d.date)}</td>
                  <td className="py-1.5 pr-2 text-right">{cell(d.foreigner)}</td>
                  <td className="py-1.5 pr-2 text-right">{cell(d.organ)}</td>
                  <td className="py-1.5 pr-2 text-right">{cell(d.individual)}</td>
                  <td className="py-1.5 text-right tabular-nums text-zinc-400">
                    {d.foreignHoldRatio != null ? `${d.foreignHoldRatio.toFixed(1)}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-zinc-400">
          ※ 순매수 수량(주). 외국인·기관은 정보·자금력이 큰 주체라 이들의 매수세는 참고 지표가 되지만, 절대적
          신호는 아닙니다.
        </p>
      </CardContent>
    </Card>
  );
}
