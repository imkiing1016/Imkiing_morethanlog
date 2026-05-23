import { NextRequest, NextResponse } from "next/server";
import { getQuotes } from "@/lib/stocks/yahoo";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const symbols = req.nextUrl.searchParams.get("symbols");
  if (!symbols) {
    return NextResponse.json({ quotes: [] });
  }
  const list = symbols
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (list.length === 0) return NextResponse.json({ quotes: [] });
  const quotes = await getQuotes(list);
  return NextResponse.json({ quotes });
}
