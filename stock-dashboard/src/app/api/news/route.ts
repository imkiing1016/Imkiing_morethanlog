import { NextRequest, NextResponse } from "next/server";
import { getMarketNews, getStockNews } from "@/lib/stocks/news";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get("ticker");
  const marketParam = req.nextUrl.searchParams.get("market");
  const market = marketParam === "US" ? "US" : "KR";
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "10");
  const safeLimit = Math.min(Math.max(limit, 1), 20);
  const items = ticker
    ? await getStockNews(ticker, safeLimit)
    : await getMarketNews(safeLimit, market);
  return NextResponse.json({ items });
}
