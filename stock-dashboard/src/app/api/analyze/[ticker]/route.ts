import { NextRequest, NextResponse } from "next/server";
import { getHistory, getQuote } from "@/lib/stocks/yahoo";
import { getFundamentals } from "@/lib/stocks/fundamentals";
import { getStockNews } from "@/lib/stocks/news";
import { buildAnalysis } from "@/lib/ai/analyze";
import type { AnalysisReport } from "@/types/stock";

export const dynamic = "force-dynamic";

const CACHE = new Map<string, { value: AnalysisReport; expires: number }>();
const TTL_MS = 1000 * 60 * 60;

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await ctx.params;
  const decoded = decodeURIComponent(ticker);
  const refresh = req.nextUrl.searchParams.get("refresh") === "1";
  const cached = CACHE.get(decoded);
  if (!refresh && cached && cached.expires > Date.now()) {
    return NextResponse.json({ ...cached.value, fromCache: true });
  }
  const [quote, history, fundamentals, news] = await Promise.all([
    getQuote(decoded),
    getHistory(decoded, "6mo"),
    getFundamentals(decoded).catch(() => undefined),
    getStockNews(decoded, 8).catch(() => []),
  ]);
  const report = await buildAnalysis({ quote, history, fundamentals, news });
  CACHE.set(decoded, { value: report, expires: Date.now() + TTL_MS });
  return NextResponse.json(report);
}
