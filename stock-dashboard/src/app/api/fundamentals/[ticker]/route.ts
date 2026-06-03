import { NextRequest, NextResponse } from "next/server";
import { getFundamentals } from "@/lib/stocks/fundamentals";

export const dynamic = "force-dynamic";

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await ctx.params;
  const decoded = decodeURIComponent(ticker);
  const data = await getFundamentals(decoded);
  return NextResponse.json(data);
}
