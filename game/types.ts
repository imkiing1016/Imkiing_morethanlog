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
}

export interface PlayerState {
  id: string;
  nickname: string;
  cash: number;
  holdings: Record<string /*companyOwnerId*/, number /*shares*/>;
  // 비공개(본인만): 이번 회차 내 섹터의 다음 이벤트 방향
  privateInfo?: Direction;
  // 비공개: 이번 회차 사전 포지션(체결 전 의도) — 서버만 보관, 정산 시 반영
  pendingPosition?: Array<{ companyOwnerId: string; shares: number /* +매수 -매도 */ }>;
  // 공개: 이번 회차 선언
  declaration?: Declaration;
  // 공개: 이번 페이즈 입력 완료 신호(서버 조기 전환 판단용). 매 페이즈 진입 시 false.
  ready: boolean;
  // 공개: 게임 시작 시 자기 회사에 박은 창업 출자 금액(0 ~ BALANCE.seedInvestedMax).
  // 매 회차 정산에서 자기 회사 주가에 추가 성장률을 부여한다.
  seedInvested: number;
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
  // 이번 회차 정산에서 적용될 글로벌 이벤트
  pendingGlobalEvent?: { sector: Sector; magnitude: number; headline: string };
  log: Array<{ round: number; text: string }>;
}

// --- 클라 ↔ 서버 메시지 프로토콜 (M0 범위) ---
// 클라는 입력만 보낸다. 서버가 상태를 계산해 스냅샷을 브로드캐스트한다.

export type ClientMessage =
  | { type: "join"; nickname: string }
  | { type: "start" } // 호스트만: LOBBY → SETUP(사업 설립)
  // 사업 설립: 카테고리 + 회사명 + 창업 출자(0 ~ BALANCE.seedInvestedMax)
  | { type: "setup"; sector: Sector; name: string; seedInvested: number }
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
