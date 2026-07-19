// 회사 매각/압류 실행 + NPC 인수 제안 생성 로직.
// GameRoom 에서 pushNews 콜백을 주입받아 사용. broadcast 는 호출측 책임.
import { BALANCE } from "../balance";
import type { Company, GameState, PlayerState } from "../types";
import { buyerSpotlightTone, pickQuote } from "./exitBuyers";
import { setPriceAndRecord } from "./pricing";

// pushNews 시그니처 — engine.ts 의 GameRoom.pushNews 와 동일.
export type PushNewsFn = (
  emoji: string,
  headline: string,
  detail: string | undefined,
  tone: "good" | "bad" | "neutral",
  extras?: {
    spotlight?: boolean;
    flavorQuote?: string;
    spotlightTone?: "celebration" | "hostile" | "somber" | "rebirth";
  }
) => void;

// 회사 매각 확정 처리.
// - 판매자에게 매각가 지급 + 투자자 모드 전환
// - 자발 매각 시(BANK 이외) 남은 대출 자동 상환. 부족분은 은행이 흡수(파산 방지)
// - 다른 홀더에게 매각가/총주식 × 지분 자동 청산
// - 회사 소멸, 그 회사 관련 남은 제안 제거
// - 같은 섹터 다른 회사들에 시장 파장
// - 스포트라이트 뉴스 push
// broadcast 는 호출측 (엔진/설정 페이즈)에서 처리.
export function executeCompanyExit(
  state: GameState,
  pushNews: PushNewsFn,
  seller: PlayerState,
  co: Company,
  salePrice: number,
  buyerKey: string,
  buyerIcon: string,
  buyerLabel: string
): void {
  const soldCoId = co.ownerId;
  const soldSector = co.sector;
  const soldName = co.name;

  // 1) 판매자에게 매각가 지급
  seller.cash += salePrice;
  seller.isInvestor = true;

  // 1.5) 자발 매각 시(BANK 이외) 남은 대출 자동 상환.
  //      BANK 경로는 processBankingSettle 에서 원금 회수 처리 완료.
  if (buyerKey !== "BANK" && seller.loanBalance > 0) {
    const takeFromSale = Math.min(seller.loanBalance, seller.cash);
    seller.cash -= takeFromSale;
    seller.loanBalance -= takeFromSale;
    seller.loanMissCount = 0;
    if (seller.loanBalance > 0) {
      state.log.push({
        round: state.round,
        text: `🏦 ${seller.nickname} 매각 상환 · 대출 잔여 ${seller.loanBalance.toLocaleString()}원은 은행 손실 흡수(탕감)`,
      });
      seller.loanBalance = 0;
    } else if (takeFromSale > 0) {
      state.log.push({
        round: state.round,
        text: `🏦 ${seller.nickname} 매각가로 대출 완납 −${takeFromSale.toLocaleString()}원`,
      });
    }
  }

  // 2) 다른 홀더 자동 청산
  const pricePerShare = Math.floor(salePrice / co.sharesOutstanding);
  for (const holder of state.players) {
    const held = holder.holdings[soldCoId] ?? 0;
    if (held > 0) {
      holder.cash += held * pricePerShare;
      delete holder.holdings[soldCoId];
    }
  }

  // 3) 회사 소멸 + 관련 제안 제거
  delete state.companies[soldCoId];
  state.exitOffers = state.exitOffers.filter(
    (o) => o.companyOwnerId !== soldCoId
  );

  // 4) 동섹터 시장 파장
  const ripple = (BALANCE.ripple as Record<string, number>)[buyerKey] ?? 0;
  if (ripple !== 0) {
    for (const other of Object.values(state.companies)) {
      if (other.sector === soldSector) {
        setPriceAndRecord(
          other,
          Math.max(1, Math.round(other.price * (1 + ripple)))
        );
      }
    }
  }

  // 5) 로그 + 스포트라이트 뉴스
  state.log.push({
    round: state.round,
    text: `${buyerIcon} ${soldName} 매각 → ${buyerLabel} (${salePrice.toLocaleString()}원, 시장가 ${(
      (salePrice / (co.price * co.sharesOutstanding)) *
      100
    ).toFixed(0)}%)`,
  });
  pushNews(
    buyerIcon,
    `${soldName} 매각 성사`,
    `${buyerLabel}가 ${salePrice.toLocaleString()}원에 인수 · 시장 ${
      ripple > 0 ? "+" : ""
    }${(ripple * 100).toFixed(0)}% 파장`,
    ripple > 0 ? "good" : ripple < 0 ? "bad" : "neutral",
    {
      spotlight: true,
      flavorQuote: pickQuote(buyerKey),
      spotlightTone: buyerSpotlightTone(buyerKey),
    }
  );
}

// 매 MANAGE 진입 시 각 회사에 대해 확률적으로 인수 제안 생성.
// 확률 = base + trust×trustBonus + tech×techBonus + endgameBonus
// 인수자별 가중치 룰렛으로 선택, 조건 (minTrust/minTech/minLie) 통과한 것만.
// 마지막에 회사별로 "제안 도착 요약" 뉴스 push.
export function generateExitOffers(
  state: GameState,
  pushNews: PushNewsFn
): void {
  state.exitOffers = [];
  let idCounter = Date.now();
  const roundsLeft = state.maxRounds - state.round;
  const endgameBonus =
    roundsLeft <= BALANCE.offerEndgameThreshold
      ? BALANCE.offerEndgameBonus
      : 0;

  for (const co of Object.values(state.companies)) {
    let numOffers = 0;
    const chance =
      BALANCE.offerBaseChance +
      co.trust * BALANCE.offerTrustBonus +
      co.techLevel * BALANCE.offerTechBonus +
      endgameBonus;
    if (Math.random() < chance) numOffers = 1;
    if (numOffers > 0 && Math.random() < chance / 2) numOffers = 2;
    if (numOffers > 1 && Math.random() < 0.2) numOffers = 3;

    // 조건 통과 인수자
    const eligible = BALANCE.exitBuyers.filter((b) => {
      const bb = b as unknown as {
        minTrust?: number;
        minTech?: number;
        minLie?: number;
        weight?: number;
      };
      if (bb.minTrust !== undefined && co.trust < bb.minTrust) return false;
      if (bb.minTech !== undefined && co.techLevel < bb.minTech) return false;
      if (bb.minLie !== undefined && co.lieCount < bb.minLie) return false;
      return true;
    });

    // 가중치 룰렛
    const marketCap = co.price * co.sharesOutstanding;
    for (let i = 0; i < numOffers; i++) {
      if (eligible.length === 0) break;
      const weights = eligible.map((b) => {
        const w = (b as unknown as { weight?: number }).weight;
        return w ?? 1;
      });
      const total = weights.reduce((a, b) => a + b, 0);
      let r = Math.random() * total;
      let picked = eligible[0];
      for (let k = 0; k < eligible.length; k++) {
        r -= weights[k];
        if (r <= 0) {
          picked = eligible[k];
          break;
        }
      }
      const [lo, hi] = picked.price;
      const priceRate = lo + Math.random() * (hi - lo);
      const price = Math.floor(marketCap * priceRate);
      state.exitOffers.push({
        id: idCounter++,
        companyOwnerId: co.ownerId,
        buyerKey: picked.key,
        buyerLabel: picked.label,
        buyerIcon: picked.icon,
        price,
        priceRate,
      });
      const pi = eligible.indexOf(picked);
      if (pi >= 0) eligible.splice(pi, 1);
    }
  }

  // 회사별 새 제안 요약 뉴스
  const grouped = new Map<string, typeof state.exitOffers>();
  for (const o of state.exitOffers) {
    if (!grouped.has(o.companyOwnerId)) grouped.set(o.companyOwnerId, []);
    grouped.get(o.companyOwnerId)!.push(o);
  }
  for (const [cid, offers] of grouped) {
    const co = state.companies[cid];
    if (!co) continue;
    const best = offers.reduce((a, b) => (a.price > b.price ? a : b));
    pushNews(
      best.buyerIcon,
      `${co.name} 인수 제안 도착`,
      `${offers.length}건 · 최고 ${best.buyerLabel} ${(
        best.priceRate * 100
      ).toFixed(0)}%`,
      best.buyerKey === "HEDGE" || best.buyerKey === "HAWK" ? "bad" : "good"
    );
  }
}
