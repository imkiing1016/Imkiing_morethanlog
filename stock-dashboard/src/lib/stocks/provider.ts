import type { Candle, Quote, Range } from "@/types/stock";
import { normalizeInput } from "./normalize";
import { mockHistory, mockQuote } from "./mock";
import { getNaverHistory, getNaverQuote } from "./naver";
import { getNaverWorldHistory, getNaverWorldQuote } from "./naver-world";

// 시세/일봉 데이터 진입점.
// 한국 주식 -> 네이버 국내, 미국 등 해외 주식 -> 네이버 해외. 실패 시 mock("샘플" 배지).
// (Yahoo는 한국 IP에서 차단되어 사용하지 않음)

const USE_MOCK = process.env.STOCK_DATA_MODE === "mock";

export async function getQuote(input: string): Promise<Quote> {
  const { market, symbol } = normalizeInput(input);
  if (USE_MOCK) return mockQuote(input);

  const fetcher = market === "KR" ? getNaverQuote : getNaverWorldQuote;
  const tag = market === "KR" ? "naver" : "naver-world";
  try {
    return await fetcher(input);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[${tag}] quote ${symbol} failed, using mock`, err);
    }
    return mockQuote(input);
  }
}

/**
 * 동시 요청 수를 제한해 순차 배치로 처리.
 * 네이버는 동시 다발 요청을 rate-limit으로 막아 mock 폴백을 유발하므로
 * 관심목록 등 다건 조회 시 동시성을 낮춰 실시간 데이터 적중률을 높인다.
 */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx]);
    }
  }
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

export async function getQuotes(inputs: string[]): Promise<Quote[]> {
  // 동시 3건까지만 (getQuote는 내부적으로 mock 폴백하므로 reject되지 않음)
  return mapLimit(inputs, 3, (i) => getQuote(i));
}

export async function getHistory(input: string, range: Range = "6mo"): Promise<Candle[]> {
  const { market, symbol } = normalizeInput(input);
  if (USE_MOCK) return mockHistory(input, rangeToDays(range));

  const fetcher = market === "KR" ? getNaverHistory : getNaverWorldHistory;
  const tag = market === "KR" ? "naver" : "naver-world";
  try {
    return await fetcher(input, range);
  } catch (err) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[${tag}] history ${symbol} failed, using mock`, err);
    }
    return mockHistory(input, rangeToDays(range));
  }
}

export function rangeToDays(range: Range): number {
  switch (range) {
    case "1mo":
      return 30;
    case "3mo":
      return 90;
    case "6mo":
      return 180;
    case "1y":
      return 365;
    case "2y":
      return 730;
    case "5y":
      return 1825;
    case "max":
      return 3650;
  }
}
