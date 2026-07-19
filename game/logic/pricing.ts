// 순수 가격 유틸.
// - setPriceAndRecord: 새 가격 반영 + 히스토리 관리 (한도 초과 시 오래된 값 제거)
// - applyImpact: 거래량 → 주가 임팩트 변환 (매수 상승, 매도 하락)
import { BALANCE, PRICE_HISTORY_LIMIT } from "../balance";

export function setPriceAndRecord(
  co: { price: number; pricePoints: number[] },
  newPrice: number
): void {
  co.price = newPrice;
  co.pricePoints.push(newPrice);
  if (co.pricePoints.length > PRICE_HISTORY_LIMIT) {
    co.pricePoints.shift();
  }
}

// 변동률 = priceImpactCoef × (체결주식 / sharesOutstanding).
// shares > 0 은 매수(상승), < 0 은 매도(하락).
export function applyImpact(
  price: number,
  shares: number,
  sharesOutstanding: number
): number {
  if (sharesOutstanding <= 0) return price;
  const ratio = shares / sharesOutstanding;
  const newPrice = price * (1 + BALANCE.priceImpactCoef * ratio);
  return Math.max(1, Math.round(newPrice));
}
