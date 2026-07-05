// 밸런스 상수 — SPEC.md 7장. 하드코딩 금지, 반드시 이 객체를 참조한다.
// 이 값들은 M6에서 플레이테스트로 조정한다.
export const BALANCE = {
  startingCash: 10_000_000, // 시작 자본 1,000만원
  startingPrice: 10_000, // 시작 주가
  startingTrust: 3,
  startingTech: 1,
  seedInvestedMax: 3_000_000, // 창업 출자 상한 = 시작 자본의 30%
  seedGrowthMax: 0.015, // 풀출자 시 회차당 추가 성장률 +1.5% (매 정산 자동)
  // 새 연구 시스템 (SPEC 3.6.5): 관리 페이즈에서 3단계 투자로 대성공/성공/실패.
  // 1회차 이후 MANAGE 부터 사용. 창업 출자의 자동 잭팟 확률은 이걸로 대체됨.
  researchTiers: [
    { cost: 1_000_000, jackpot: 0.05, success: 0.25 }, // 실패 70%
    { cost: 3_000_000, jackpot: 0.15, success: 0.45 }, // 실패 40%
    { cost: 5_000_000, jackpot: 0.3, success: 0.55 }, // 실패 15%
  ] as const,
  researchJackpotRange: [0.4, 0.6] as const, // 대성공 시 +40~60%
  researchSuccessRange: [0.1, 0.2] as const, // 성공 시 +10~20%
  // 실패 시 손실 없음 (돈만 날림)
  auditLieThreshold: 3, // 누적 거짓 N회 → 세무 조사 발동 (SPEC 3.7)
  auditPenaltyRange: [0.15, 0.25] as const, // 세무 조사 추가 악재 폭 (15~25%)
  infoBuyCost: 500_000, // 정보 1건 구매 비용 (SPEC 2장 ①)
  infoBuyMax: 2, // 회차당 본인 외 추가로 살 수 있는 정보 건수
  // 거래량 → 주가 임팩트 계수 (SPEC 2장 ④). 0.2→0.4로 상향(매매 반응 더 크게).
  priceImpactCoef: 0.4,
  liveTradeStep: 10, // TRADE +/- 버튼 한 번에 거래되는 주식 수
  // 거래 페이즈 시장 마이크로 노이즈 — 상시 잔파도로 차트가 살아있게 한다.
  tradeNoiseIntervalMs: 1500, // 매 1.5초마다 노이즈 틱
  tradeNoiseMagnitude: 0.008, // 최대 ±0.8% 흔들림 (평균 0)
  globalEventMagnitudeRange: [0.1, 0.25] as const, // 글로벌 이벤트 강도 (SPEC 3.6)
  techGrowthPerLevel: 0.01, // 기술 레벨당 정산 시 기본 주가 상승률 (+1%/lvl, SPEC 3.3)
  manageWindowSec: 30, // 관리 페이즈 타이머 (SPEC 3.3~3.5)
  minBidIncrement: 100_000, // 엑시트 경매 최소 입찰 증가 폭
  maxSelfOwnership: 0.6, // 자기 회사 지분 상한
  trustInfluence: (t: number) => 0.4 + 0.12 * t,
  eventMagnitudeRange: [0.15, 0.4] as const, // 강도 랜덤 범위
  tradeWindowSec: 45,
  techUpgradeCost: (lvl: number) => 1_000_000 * lvl,
  pivotCostRate: 0.3,
  exitMinPriceRate: (t: number) => 0.8 + 0.08 * t,
  meanReversionWeight: 0.5, // 과열 섹터 역풍 가중
};

// 게임 규칙 상수 (SPEC 1장).
// minPlayers는 1까지 허용 (테스트용 봇으로 인원 채우기 가능 - SPEC 1.0.5).
// 실제 멀티 플레이 권장은 여전히 3명 이상.
export const ROOM = {
  minPlayers: 1,
  maxPlayers: 6,
  defaultMaxRounds: 8,
};
