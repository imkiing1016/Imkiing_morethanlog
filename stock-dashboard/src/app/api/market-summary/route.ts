import { NextResponse } from "next/server";
import { getMarketIndices } from "@/lib/stocks/markets";
import { getMarketNews } from "@/lib/stocks/news";
import { buildMarketSummary } from "@/lib/ai/market-summary";
import type { MarketSummary } from "@/lib/ai/market-summary";

export const dynamic = "force-dynamic";

let CACHE: { value: MarketSummary; expires: number } | null = null;
const TTL_MS = 1000 * 60 * 15;

export async function GET() {
  if (CACHE && CACHE.expires > Date.now()) {
    return NextResponse.json(CACHE.value);
  }
  const [news, indices] = await Promise.all([getMarketNews(12), getMarketIndices()]);
  const summary = await buildMarketSummary({ news, indices });
  CACHE = { value: summary, expires: Date.now() + TTL_MS };
  return NextResponse.json(summary);
}
