import { NextRequest, NextResponse } from "next/server";
import { normalizeInput } from "@/lib/stocks/normalize";

export const dynamic = "force-dynamic";

const YAHOO_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  Accept: "application/json,text/plain,*/*",
};

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await ctx.params;
  const decoded = decodeURIComponent(ticker);
  const { symbol, market } = normalizeInput(decoded);

  if (process.env.STOCK_DATA_MODE === "mock") {
    return NextResponse.json({ valid: true, symbol, market, source: "mock" });
  }

  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  try {
    const res = await fetch(url, { headers: YAHOO_HEADERS, cache: "no-store" });
    if (!res.ok) {
      return NextResponse.json({
        valid: false,
        symbol,
        market,
        reason: `Yahoo Finance 응답 오류 (${res.status})`,
      });
    }
    const json = (await res.json()) as {
      chart?: { error?: { description?: string }; result?: unknown[] };
    };
    if (json.chart?.error) {
      return NextResponse.json({
        valid: false,
        symbol,
        market,
        reason: json.chart.error.description ?? "유효하지 않은 티커",
      });
    }
    if (!json.chart?.result?.length) {
      return NextResponse.json({
        valid: false,
        symbol,
        market,
        reason: "데이터를 찾을 수 없음",
      });
    }
    return NextResponse.json({ valid: true, symbol, market, source: "yahoo" });
  } catch (err) {
    return NextResponse.json({
      valid: true,
      symbol,
      market,
      reason: `검증 우회 (네트워크 오류: ${(err as Error).message})`,
      source: "skipped",
    });
  }
}
