import { NextRequest, NextResponse } from "next/server";
import { getQuote } from "@/lib/stocks/provider";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await ctx.params;
  const quote = await getQuote(decodeURIComponent(ticker));
  return NextResponse.json(quote);
}
