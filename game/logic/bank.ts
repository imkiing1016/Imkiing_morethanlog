// 은행 시스템 로직: 이자 부과 · 미납 처리 · 압류 판정 · 투자자 세금.
// SETTLE 페이즈에서 호출됨. broadcast 는 SETTLE 진입 시 자동 처리.
import { BALANCE } from "../balance";
import type { Company, GameState, PlayerState } from "../types";
import { clampTrust } from "../helpers";
import { executeCompanyExit, type PushNewsFn } from "./exit";
import { setPriceAndRecord } from "./pricing";

// 신뢰도에 따른 대출 한도. 투자자/회사 없는 경우 0.
export function loanLimitFor(state: GameState, player: PlayerState): number {
  if (player.isInvestor || !state.companies[player.id]) return 0;
  const co = state.companies[player.id];
  return BALANCE.bankLoanLimitByTrust[clampTrust(co.trust)];
}

// 신뢰도에 따른 이자율. 투자자/회사 없는 경우 0.
export function loanRateFor(state: GameState, player: PlayerState): number {
  if (player.isInvestor || !state.companies[player.id]) return 0;
  const co = state.companies[player.id];
  return BALANCE.bankInterestByTrust[clampTrust(co.trust)];
}

// SETTLE 정산 은행 단계: 세금 → 이자 → 미납 처리 → 압류 실행.
export function processBankingSettle(
  state: GameState,
  pushNews: PushNewsFn
): void {
  // 1) 투자자 매매 이익세 (roundTradesCashFlow > 0 이면 과세).
  for (const p of state.players) {
    if (!p.isInvestor) continue;
    if (p.roundTradesCashFlow <= 0) continue;
    const tax = Math.floor(p.roundTradesCashFlow * BALANCE.investorTaxRate);
    if (tax <= 0) continue;
    // 현금 부족 시 가능한 만큼만 걷음 (파산 방지).
    const collected = Math.min(tax, p.cash);
    p.cash -= collected;
    state.log.push({
      round: state.round,
      text: `📮 ${p.nickname} 매매 이익세 −${collected.toLocaleString()}원 (수익 ${p.roundTradesCashFlow.toLocaleString()}원)`,
    });
    if (collected >= BALANCE.investorTaxNewsThreshold) {
      pushNews(
        "📮",
        `${p.nickname} 매매 이익세 납부`,
        `투자자 세금 ${collected.toLocaleString()}원 · 이번 회차 순매도 우세`,
        "neutral"
      );
    }
  }

  // 2) 회사 소유자 이자 부과. 압류 대상은 여기서 표시만.
  const foreclosureVictims: Array<{ player: PlayerState; co: Company }> = [];
  for (const p of state.players) {
    if (p.isInvestor) continue;
    const co = state.companies[p.id];
    if (!co) continue;
    if (p.loanBalance <= 0) {
      p.loanMissCount = 0;
      continue;
    }
    const rate = loanRateFor(state, p);
    const interest = Math.floor(p.loanBalance * rate);
    if (interest <= 0) continue;

    if (p.cash >= interest) {
      // 정상 상환 → 미납 카운트 리셋 + 이자만 차감.
      p.cash -= interest;
      p.loanMissCount = 0;
      state.log.push({
        round: state.round,
        text: `🏦 ${co.name} 이자 −${interest.toLocaleString()}원 (원금 ${p.loanBalance.toLocaleString()}원)`,
      });
    } else {
      // 미납 처리.
      p.loanMissCount += 1;
      const missIdx = Math.min(
        p.loanMissCount - 1,
        BALANCE.bankMissPenaltyRange.length - 1
      );
      const [lo, hi] = BALANCE.bankMissPenaltyRange[missIdx];
      const drop = lo + Math.random() * (hi - lo);
      const newPrice = Math.max(1, Math.round(co.price * (1 - drop)));
      setPriceAndRecord(co, newPrice);
      co.trust = Math.max(0, co.trust - 1);

      state.log.push({
        round: state.round,
        text: `⚠️ ${co.name} 이자 미납 ${p.loanMissCount}회 — 주가 ${(drop * 100).toFixed(1)}% 하락, 신뢰 −1`,
      });

      if (p.loanMissCount >= BALANCE.bankMissForForeclosure) {
        foreclosureVictims.push({ player: p, co });
      } else {
        const isMarginCall = p.loanMissCount >= 2;
        pushNews(
          isMarginCall ? "🚨" : "⚠️",
          `${co.name} 이자 미납 ${p.loanMissCount}회`,
          `주가 ${(drop * 100).toFixed(1)}% ↓ · 신뢰 −1${isMarginCall ? " · 마진콜 · 다음 미납이면 압류" : ""}`,
          "bad"
        );
      }
    }
  }

  // 3) 압류 실행 (executeCompanyExit 재활용, buyerKey = BANK).
  for (const victim of foreclosureVictims) {
    const marketCap = victim.co.price * victim.co.sharesOutstanding;
    const totalRecovery = marketCap;
    const bankTake = Math.min(victim.player.loanBalance, totalRecovery);
    const sellerPayout = Math.max(0, totalRecovery - bankTake);
    victim.player.loanBalance = 0;
    victim.player.loanMissCount = 0;
    executeCompanyExit(
      state,
      pushNews,
      victim.player,
      victim.co,
      sellerPayout,
      "BANK",
      "🔴",
      "은행 압류"
    );
    state.log.push({
      round: state.round,
      text: `🔴 ${victim.co.name} 은행 압류 — 대출 ${bankTake.toLocaleString()}원 회수, 판매자 잔여 ${sellerPayout.toLocaleString()}원`,
    });
  }
}
