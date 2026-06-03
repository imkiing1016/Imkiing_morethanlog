import { NextResponse } from "next/server";
import { getMarketIndices } from "@/lib/stocks/markets";

export const dynamic = "force-dynamic";

export async function GET() {
  const indices = await getMarketIndices();
  return NextResponse.json({ indices });
}
