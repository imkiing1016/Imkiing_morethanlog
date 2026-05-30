import { NextRequest, NextResponse } from "next/server";
import { normalizeInput } from "@/lib/stocks/normalize";
import { getQuote } from "@/lib/stocks/provider";

export const dynamic = "force-dynamic";

// 종목 존재 검증: 네이버 시세 조회를 시도하고 출처로 유효성 판단.
// source==="naver"  -> 실제 데이터 확인됨 (유효)
// source==="mock"   -> 확인 불가(네이버 차단/미존재)지만 형식은 통과 → 추가는 허용하되 미확인 표시
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ ticker: string }> },
) {
  const { ticker } = await ctx.params;
  const decoded = decodeURIComponent(ticker);
  const { symbol, market } = normalizeInput(decoded);

  try {
    const quote = await getQuote(decoded);
    if (quote.source === "naver") {
      return NextResponse.json({
        valid: true,
        symbol,
        market,
        name: quote.name,
        source: "naver",
      });
    }
    // mock으로 떨어진 경우: 실시간 확인은 안 되지만 차단/네트워크 이슈일 수 있어 추가는 허용
    return NextResponse.json({
      valid: true,
      symbol,
      market,
      name: quote.name,
      source: "unverified",
      reason: "실시간 확인 불가 (네이버 응답 없음) — 추가는 가능",
    });
  } catch {
    return NextResponse.json({
      valid: false,
      symbol,
      market,
      reason: "종목을 확인할 수 없습니다",
    });
  }
}
