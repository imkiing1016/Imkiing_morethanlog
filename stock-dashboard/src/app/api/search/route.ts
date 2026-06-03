import { NextRequest, NextResponse } from "next/server";
import { searchSymbols } from "@/lib/stocks/search";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q") ?? "";
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? "10");
  if (!q.trim()) return NextResponse.json({ results: [] });
  const results = await searchSymbols(q, Math.min(Math.max(limit, 1), 25));
  return NextResponse.json({ results });
}
