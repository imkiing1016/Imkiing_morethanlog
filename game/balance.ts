// 밸런스 상수 — SPEC.md 7장. 하드코딩 금지, 반드시 이 객체를 참조한다.
// 이 값들은 M6에서 플레이테스트로 조정한다.
export const BALANCE = {
  startingCash: 10_000_000, // 시작 자본 1,000만원
  startingPrice: 10_000, // 시작 주가
  startingTrust: 3,
  startingTech: 1,
  seedInvestedMax: 3_000_000, // 창업 출자 상한 = 시작 자본의 30%
  seedGrowthMax: 0.015, // 풀출자 시 회차당 추가 성장률 +1.5%
  researchBaseChance: 0.08, // 풀출자 시 회차당 연구 성공 확률 (SPEC 3.6.5)
  researchBoostRange: [0.4, 0.8] as const, // 연구 성공 시 극호재 폭 (+40~80%)
  auditLieThreshold: 3, // 누적 거짓 N회 → 세무 조사 발동 (SPEC 3.7)
  auditPenaltyRange: [0.15, 0.25] as const, // 세무 조사 추가 악재 폭 (15~25%)
  infoBuyCost: 500_000, // 정보 1건 구매 비용 (SPEC 2장 ①)
  infoBuyMax: 2, // 회차당 본인 외 추가로 살 수 있는 정보 건수
  maxSelfOwnership: 0.6, // 자기 회사 지분 상한
  trustInfluence: (t: number) => 0.4 + 0.12 * t,
  eventMagnitudeRange: [0.15, 0.4] as const, // 강도 랜덤 범위
  tradeWindowSec: 45,
  techUpgradeCost: (lvl: number) => 1_000_000 * lvl,
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
