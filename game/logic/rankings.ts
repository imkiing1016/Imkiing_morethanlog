// 게임 종료 시 총자산 랭킹 계산 (SPEC 1장).
// 총자산 = 현금 + 보유 주식 평가액 + 내 회사 미보유 지분 평가액.
import { computeStocksValue } from "../helpers";
import type { GameState, RankingRow } from "../types";

export function computeFinalRankings(state: GameState): RankingRow[] {
  const rows: RankingRow[] = state.players.map((p) => {
    const cash = p.cash;
    const stocksValue = computeStocksValue(p, state.companies);
    let ownCompanyValue = 0;
    const myCo = state.companies[p.id];
    if (myCo) {
      const totalHeld = state.players.reduce(
        (s, other) => s + (other.holdings[p.id] ?? 0),
        0
      );
      const unowned = Math.max(0, myCo.sharesOutstanding - totalHeld);
      ownCompanyValue = unowned * myCo.price;
    }
    return {
      playerId: p.id,
      nickname: p.nickname,
      totalAssets: cash + stocksValue + ownCompanyValue,
      cash,
      stocksValue,
      ownCompanyValue,
    };
  });
  rows.sort((a, b) => b.totalAssets - a.totalAssets);
  return rows;
}
