// 서버 권위 상태 타입 — SPEC.md 4장을 단일 진실 원천으로 한다.
// 서버(WebSocket room)가 이 상태를 보유하고 클라에 스냅샷을 내린다.

// 사업 카테고리 6종 (SPEC 1.1)
export type Sector =
  | "IT_GAME"
  | "BEAUTY"
  | "CONSTRUCTION"
  | "RETAIL"
  | "BIO"
  | "DEFENSE";

// 선택 가능한 카테고리 목록과 한글 라벨(서버·클라 공용).
export const SECTORS: Sector[] = [
  "IT_GAME",
  "BEAUTY",
  "CONSTRUCTION",
  "RETAIL",
  "BIO",
  "DEFENSE",
];

export const SECTOR_LABELS: Record<Sector, string> = {
  IT_GAME: "IT/게임",
  BEAUTY: "뷰티",
  CONSTRUCTION: "건설",
  RETAIL: "유통",
  BIO: "바이오",
  DEFENSE: "방산",
};

// 섹터별 토픽 아이콘(자리표시 이모지). 분야를 바로 알 수 있게.
// 후일 픽셀아트/일러스트로 교체 가능.
export const SECTOR_MASCOTS: Record<Sector, string> = {
  IT_GAME: "🎮", // 게임 컨트롤러
  BEAUTY: "💄", // 립스틱
  CONSTRUCTION: "🏗️", // 건설 크레인
  RETAIL: "🛒", // 쇼핑 카트
  BIO: "🧬", // DNA
  DEFENSE: "🛡️", // 방패
};

export type Phase =
  | "LOBBY"
  | "SETUP"
  | "INFO"
  | "POSITION"
  | "DECLARE"
  | "TRADE"
  | "SETTLE"
  | "MANAGE"
  | "ENDED";

export type Declaration = "HYPE" | "WARN" | "SILENT";
export type Direction = "BULLISH" | "BEARISH";

export interface Company {
  ownerId: string; // 플레이어 id
  name: string;
  sector: Sector;
  price: number; // 현재 주가
  techLevel: number; // 1~5
  trust: number; // 0~5
  sharesOutstanding: number;
  // 가격 히스토리 (최근 N틱). 거래/정산마다 push. 캐시 한도 PRICE_HISTORY_LIMIT.
  // 실시간 차트 표시용. 게임 로직엔 영향 없음.
  pricePoints: number[];
  // 이번 회차 정산 직전 스냅샷(SETTLE 화면 비교용). 매 SETTLE 진입 시 갱신.
  prevSettlePrice?: number;
  prevSettleTrust?: number;
  // SPEC 3.6.5 연구: 관리 페이즈에서 투자 → 대성공/성공/실패.
  // MANAGE 진입 시 false 로 리셋, 회차당 1회만 가능.
  researchDoneThisManage: boolean;
  // 최근 연구 결과 (UI/뉴스 팝업 표시용). null 이면 아직 연구 없음.
  lastResearchOutcome?: "jackpot" | "success" | "fail";
  // 하위 호환: 예전 자동 잭팟 필드. 새 시스템에선 안 씀(항상 false) 하지만 타입만 유지.
  researchBreakthroughThisRound: boolean;
  // SPEC 3.7 세무 조사
  lieCount: number; // 누적 거짓 선언 횟수 (audit 발동 시 0으로 리셋)
  auditedThisRound: boolean; // 이번 정산에서 세무 조사 발동 여부 (UI/로그 표시용)
}

export interface PlayerState {
  id: string;
  nickname: string;
  cash: number;
  holdings: Record<string /*companyOwnerId*/, number /*shares*/>;
  // 비공개(본인만): 이번 회차 내 섹터의 다음 이벤트 방향
  privateInfo?: Direction;
  // 비공개(본인만): 정보 페이즈에서 돈을 내고 추가로 산 다른 회사 정보
  purchasedInfos: Array<{ ownerId: string; direction: Direction }>;
  // 비공개: 이번 회차 사전 포지션(체결 전 의도) — 서버만 보관, 정산 시 반영
  pendingPosition?: Array<{ companyOwnerId: string; shares: number /* +매수 -매도 */ }>;
  // 공개: 이번 회차 선언
  declaration?: Declaration;
  // 공개: 선언에 딸린 코멘트(모든 플레이어에게 보임). 최대 60자.
  declarationComment?: string;
  // 공개: 이번 페이즈 입력 완료 신호(서버 조기 전환 판단용). 매 페이즈 진입 시 false.
  ready: boolean;
  // 공개: 게임 시작 시 자기 회사에 박은 창업 출자 금액(0 ~ BALANCE.seedInvestedMax).
  // 매 회차 정산에서 자기 회사 주가에 추가 성장률을 부여한다.
  seedInvested: number;
  // 테스트용 봇 여부 (SPEC 1.0.5).
  isBot?: boolean;
  connected: boolean;
}

export interface GameState {
  roomCode: string;
  phase: Phase;
  round: number; // 1..maxRounds
  maxRounds: number;
  hostId: string;
  players: PlayerState[];
  companies: Record<string /*ownerId*/, Company>;
  phaseDeadline?: number; // epoch ms, 거래 페이즈 타이머
  // 관리 페이즈 진행 중인 경매 목록(엑시트). MANAGE 종료 시 낙찰 처리.
  auctions: Array<{
    companyOwnerId: string; // 판매 개시 시점의 회사 소유자(원 판매자)
    minBid: number;
    topBid?: { bidderId: string; amount: number };
  }>;
  // 시장 뉴스 이벤트 스트림 — 우측 상단 팝업 카드로 표시.
  // 서버가 push, 클라가 최근 N개 렌더 + 오래된 것 자동 dismiss.
  newsEvents: Array<{
    id: number;
    timestamp: number;
    emoji: string;
    headline: string;
    detail?: string;
    tone: "good" | "bad" | "neutral";
  }>;
  // 이번 회차 정산에서 적용될 글로벌 이벤트 (INFO 진입 시 결정 → SETTLE 에 적용)
  pendingGlobalEvent?: { sector: Sector; magnitude: number; headline: string };
  // 평균회귀용: 직전 회차에 누적 가격 변동률이 가장 컸던 섹터(과열 응징).
  lastHotSector?: Sector;
  // 게임 종료 시 최종 순위(총자산 기준). ENDED 진입 시 서버에서 계산해 채운다.
  finalRankings?: Array<{
    playerId: string;
    nickname: string;
    totalAssets: number;
    cash: number;
    stocksValue: number;
    ownCompanyValue: number;
  }>;
  log: Array<{ round: number; text: string }>;
}

// --- 클라 ↔ 서버 메시지 프로토콜 (M0 범위) ---
// 클라는 입력만 보낸다. 서버가 상태를 계산해 스냅샷을 브로드캐스트한다.

export type ClientMessage =
  | { type: "join"; nickname: string }
  | { type: "start" } // 호스트만: LOBBY → SETUP(사업 설립)
  | { type: "addBot" } // 호스트만, 로비에서 테스트용 봇 추가 (SPEC 1.0.5)
  // 사업 설립: 카테고리 + 회사명 + 창업 출자(0 ~ BALANCE.seedInvestedMax)
  | { type: "setup"; sector: Sector; name: string; seedInvested: number }
  // 정보 페이즈: 다른 회사의 다음 이벤트 방향 1건 구매 (현금 지불, 최대 infoBuyMax)
  | { type: "buyInfo"; targetOwnerId: string }
  // 포지션 페이즈: 비공개 매수/매도 의도 일괄 제출 (양수=매수, 음수=매도)
  | {
      type: "submitPosition";
      orders: Array<{ companyOwnerId: string; shares: number }>;
    }
  // 거래 페이즈: 실시간 단건 체결 (양수=매수, 음수=매도)
  | { type: "trade"; companyOwnerId: string; shares: number }
  // 선언 페이즈: HYPE/WARN/SILENT 1장 + 코멘트(선택, 60자)
  | { type: "declare"; declaration: Declaration; comment?: string }
  // 관리 페이즈: 기술 레벨 업그레이드 (레벨당 techUpgradeCost 지불)
  | { type: "techUpgrade" }
  // 관리 페이즈: 연구 투자 (3단계 tier). 결과 즉시 적용
  | { type: "research"; tier: 0 | 1 | 2 }
  // 관리 페이즈: 사업 전환(피벗). 새 섹터로 이동, 신뢰도 3 리셋
  | { type: "pivot"; newSector: Sector }
  // 관리 페이즈: 회사 매각 리스트업 (판매 개시)
  | { type: "listExit" }
  // 관리 페이즈: 매각 중인 회사에 입찰
  | { type: "bidExit"; targetOwnerId: string; amount: number }
  // 게임 종료 후: 호스트가 리매치 (같은 인원으로 로비 복귀)
  | { type: "rematch" }
  | { type: "ready" }; // 현재 페이즈 입력 완료 신호 (TRADE 제외 조기 전환용)

// 회차 내 페이즈 진행 순서 — SPEC 2장 고정. 절대 건너뛰지 않는다.
export const ROUND_PHASES: Phase[] = [
  "INFO",
  "POSITION",
  "DECLARE",
  "TRADE",
  "SETTLE",
];

// 서버 → 클라: 플레이어별 개인화 스냅샷.
// 비공개 필드(privateInfo/pendingPosition)는 본인 것만 채워 보낸다.
export type ServerMessage = {
  type: "snapshot";
  state: GameState;
  selfId: string;
};
