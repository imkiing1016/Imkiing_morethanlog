import { NextRequest, NextResponse } from "next/server";
import { getHistory, getQuote } from "@/lib/stocks/provider";
import { runBacktest } from "@/lib/analysis/backtest";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, ctx: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await ctx.params;
  const decoded = decodeURIComponent(ticker);
  const horizon = Number(req.nextUrl.searchParams.get("horizon") ?? "5");
  const [quote, candles] = await Promise.all([
    getQuote(decoded),
    getHistory(decoded, "2y"),
  ]);
  const result = runBacktest(quote.ticker, candles, quote.market, {
    horizon: Math.min(Math.max(horizon, 1), 20),
  });
  if (!result) {
    return NextResponse.json({ error: "데이터가 부족해 백테스트할 수 없습니다." }, { status: 422 });
  }
  return NextResponse.json(result);
}
