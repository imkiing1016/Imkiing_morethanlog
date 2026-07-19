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
    { cost: 500_000, jackpot: 0.05, success: 0.25 }, // 실패 70%
    { cost: 1_500_000, jackpot: 0.15, success: 0.45 }, // 실패 40%
    { cost: 2_500_000, jackpot: 0.3, success: 0.55 }, // 실패 15%
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
  // === 엑시트 시스템 (개편판) ===
  // 국가 매각: 시장가 × 이 비율 (즉시 확정)
  nationBuyoutRate: 0.5,
  // NPC 인수 제안 확률/가격 (매 MANAGE 진입 시 회사별로 계산)
  //   기본 확률 30% + 신뢰도×5% + 기술레벨×3% + 종반보너스(회차 ≤3 남으면 +20%)
  offerBaseChance: 0.15,
  offerTrustBonus: 0.05,
  offerTechBonus: 0.03,
  offerEndgameBonus: 0.2,
  offerEndgameThreshold: 3, // 남은 회차 ≤ 이 값일 때 종반 보너스
  // 인수자 타입별 (조건 · 가격 범위 · 시장 파장)
  // 저조건이 낮은 순서로 나열, 랜덤 룰렛 시 조건 통과한 것 중 하나 선택.
  exitBuyers: [
    { key: "HAWK",    label: "월가의 매파",      icon: "🐺", price: [0.40, 0.55] as const, tone: "bad" as const },
    { key: "HEDGE",   label: "적대적 헤지펀드",  icon: "🎭", price: [0.30, 0.40] as const, tone: "bad" as const,     minLie: 2 },
    { key: "CHAEBOL", label: "재벌 3세",         icon: "🏢", price: [0.60, 0.75] as const, tone: "neutral" as const, minTrust: 3 },
    { key: "VC",      label: "벤처캐피탈",       icon: "🌟", price: [0.80, 0.95] as const, tone: "good" as const,    minTrust: 4, minTech: 3, weight: 0.5 },
    { key: "MYSTERY", label: "비밀 매수자",      icon: "🕵️", price: [1.00, 1.20] as const, tone: "good" as const,    weight: 0.05 },
  ] as const,
  offerMaxPending: 3, // 한 회사가 동시에 받을 수 있는 최대 제안
  // 매각 시 동섹터 시장 파장 (해당 매각 종류에 따라 나머지 회사 주가 변동)
  ripple: {
    NATION: 0.10,  // 국가 매각 → 경쟁자 반사이익
    HAWK: 0.05,
    CHAEBOL: 0.05,
    VC: 0.08,      // 러브콜 → 섹터 재조명
    HEDGE: -0.12,  // 헤지펀드 → 섹터 도미노
    MYSTERY: 0.05,
    BANK: -0.08,   // 은행 압류 → 섹터 신뢰 손상
  } as const,
  // 부활 IPO (엑시트 후 새 회사 창업)
  rebirthCost: 5_000_000,
  rebirthMinRoundsLeft: 3, // 남은 회차가 이 값 이상일 때만
  rebirthCapMultiplier: 0.7, // 시장 평균 시총의 이 비율로 시작
  maxSelfOwnership: 0.6, // 자기 회사 지분 상한
  trustInfluence: (t: number) => 0.4 + 0.12 * t,
  eventMagnitudeRange: [0.15, 0.4] as const, // 강도 랜덤 범위
  tradeWindowSec: 45,
  techUpgradeCost: (lvl: number) => 1_000_000 * lvl,
  pivotCostRate: 0.3,
  exitMinPriceRate: (t: number) => 0.8 + 0.08 * t,
  meanReversionWeight: 0.5, // 과열 섹터 역풍 가중

  // === 은행 시스템 ===
  // 회사 소유자 대출 한도 · 이자율 (신뢰도 ★별 밴드).
  // 신뢰도 배열 인덱스 = 신뢰도 값(0~5). 예: trust 5 → limit 3천만, 이자 5%
  bankLoanLimitByTrust: [
    10_000_000, // ★0
    15_000_000, // ★1
    20_000_000, // ★2
    30_000_000, // ★3
    30_000_000, // ★4
    30_000_000, // ★5
  ] as const,
  bankInterestByTrust: [
    0.17, // ★0
    0.13, // ★1
    0.10, // ★2
    0.07, // ★3
    0.05, // ★4
    0.03, // ★5
  ] as const,
  // 미납 카운트 3회 도달 시 압류. 이자 정상 상환하면 카운트 리셋(0).
  bankMissForForeclosure: 3,
  // 이자 미납 시 회사 주가 하락 폭 (미납 카운트별 랜덤 범위).
  bankMissPenaltyRange: [
    [0.03, 0.07] as const, // 1회 미납: −3~7%
    [0.05, 0.10] as const, // 2회 미납: −5~10%
    [0.08, 0.15] as const, // 3회 미납(압류 직전): −8~15% (형식상, 실제로는 압류로 대체)
  ] as const,
  // 압류 시장 파장 (동섹터 다른 회사 주가에 이 비율 적용).
  bankForeclosureRipple: -0.08,

  // === 투자자 특권/제약 ===
  // 매 회차 주식 매수 총액 상한 (POSITION + TRADE 합산). 매도는 무제한.
  investorBuyQuotaPerRound: 5_000_000,
  // 매매 이익세: SETTLE에서 roundTradesCashFlow > 0 이면 세율 적용.
  investorTaxRate: 0.20,
  // 세금 뉴스 노출 임계값 (이 값 이상 과세 시 뉴스 팝업).
  investorTaxNewsThreshold: 2_000_000,
};

// 게임 규칙 상수 (SPEC 1장).
// minPlayers는 1까지 허용 (테스트용 봇으로 인원 채우기 가능 - SPEC 1.0.5).
// 실제 멀티 플레이 권장은 여전히 3명 이상.
export const ROOM = {
  minPlayers: 1,
  maxPlayers: 6,
  defaultMaxRounds: 8,
};

// 시장/뉴스 저장소 상한 상수. 서버 메모리 제한 방어용.
export const SHARES_OUTSTANDING = 1000; // 전 회사 동일 → 시작 시총 동일 (price × shares)
export const PRICE_HISTORY_LIMIT = 40; // 회사별 가격 히스토리 최대 보관 점수
export const NEWS_LIMIT = 20; // 뉴스 이벤트 최대 보관 (오래된 것부터 제거)
