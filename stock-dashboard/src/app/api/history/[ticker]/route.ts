import { NextRequest, NextResponse } from "next/server";
import { getHistory } from "@/lib/stocks/provider";
import type { Range } from "@/types/stock";

export const dynamic = "force-dynamic";

const VALID: Range[] = ["1mo", "3mo", "6mo", "1y", "2y", "5y", "max"];

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await ctx.params;
  const rangeParam = req.nextUrl.searchParams.get("range") ?? "6mo";
  const range = (VALID.includes(rangeParam as Range) ? rangeParam : "6mo") as Range;
  const candles = await getHistory(decodeURIComponent(ticker), range);
  return NextResponse.json({ candles, range });
}
