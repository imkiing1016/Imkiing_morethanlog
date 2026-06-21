// 밸런스 상수 — SPEC.md 7장. 하드코딩 금지, 반드시 이 객체를 참조한다.
// 이 값들은 M6에서 플레이테스트로 조정한다.
export const BALANCE = {
  startingCash: 8000,
  startingPrice: 1000,
  startingTrust: 3,
  startingTech: 1,
  maxSelfOwnership: 0.6, // 자기 회사 지분 상한
  trustInfluence: (t: number) => 0.4 + 0.12 * t,
  eventMagnitudeRange: [0.15, 0.4] as const, // 강도 랜덤 범위
  tradeWindowSec: 45,
  techUpgradeCost: (lvl: number) => 1000 * lvl,
  pivotCostRate: 0.3,
  exitMinPriceRate: (t: number) => 0.8 + 0.08 * t,
  meanReversionWeight: 0.5, // 과열 섹터 역풍 가중
};

// 게임 규칙 상수 (SPEC 1장)
export const ROOM = {
  minPlayers: 3,
  maxPlayers: 6,
  defaultMaxRounds: 8,
};
