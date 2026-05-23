import { NextRequest, NextResponse } from "next/server";
import { getMarketSentiment } from "@/lib/stocks/sentiment";
import type { Market } from "@/types/stock";

export const dynamic = "force-dynamic";
export const revalidate = 60;

export async function GET(req: NextRequest) {
  const marketParam = req.nextUrl.searchParams.get("market");
  const market: Market = marketParam === "US" ? "US" : "KR";
  const sentiment = await getMarketSentiment(market);
  return NextResponse.json({ market, ...sentiment });
}
