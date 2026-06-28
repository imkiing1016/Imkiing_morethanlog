import { BALANCE, ROOM } from "./balance";
import { ROUND_PHASES, SECTORS } from "./types";
import type {
  ClientMessage,
  GameState,
  Phase,
  PlayerState,
  Sector,
  ServerMessage,
} from "./types";

// 한 연결의 추상화. 전송 계층(ws 등)과 무관하게 게임 로직만 다룬다.
export interface Conn {
  id: string;
  send(data: string): void;
}

const SHARES_OUTSTANDING = 1000; // 전원 동일 → 시작 시총 동일 (price × shares)

// 페이즈 진입 시 남길 로그 문구 (사람이 읽는 한 줄).
const PHASE_LOG: Record<Phase, string> = {
  SETUP: "사업 설립 — 카테고리/회사명 설정",
  INFO: "정보 페이즈 — 비공개 정보 수신",
  POSITION: "사전 포지션 페이즈 — 비공개 매매",
  DECLARE: "선언 페이즈 — 전망 카드 공개",
  TRADE: "거래 페이즈 — 제한시간 호가",
  SETTLE: "정산 페이즈 — 이벤트 발동/손익 정산",
  MANAGE: "관리 페이즈",
  LOBBY: "로비",
  ENDED: "게임 종료",
};

// 권위 게임 방 — SPEC.md 0장/2장/8장.
// 모든 게임 상태 계산과 페이즈 전환은 여기(서버)에서만. 전송 계층은 Conn 으로 주입된다.
export class GameRoom {
  state: GameState;
  private conns = new Map<string, Conn>();
  private tradeTimer?: ReturnType<typeof setTimeout>;

  constructor(roomCode: string) {
    this.state = {
      roomCode,
      phase: "LOBBY",
      round: 0,
      maxRounds: ROOM.defaultMaxRounds,
      hostId: "",
      players: [],
      companies: {},
      log: [],
    };
  }

  get connectionCount(): number {
    return this.conns.size;
  }

  // --- 연결 수명주기 ---

  addConn(conn: Conn) {
    this.conns.set(conn.id, conn);

    const known = this.state.players.find((p) => p.id === conn.id);
    if (known) {
      // 재접속: 같은 식별자면 즉시 연결 상태로 복귀.
      known.connected = true;
      this.broadcastSnapshot();
      return;
    }
    // 처음 보는 연결은 아직 플레이어로 등록하지 않는다. "join" 에서 등록.
    this.sendSnapshotTo(conn);
  }

  // 같은 conn 인스턴스일 때만 제거(재접속 레이스로 새 연결을 지우지 않도록).
  removeConn(conn: Conn) {
    if (this.conns.get(conn.id) !== conn) return;
    this.conns.delete(conn.id);

    const player = this.state.players.find((p) => p.id === conn.id);
    if (!player) return;
    player.connected = false;
    if (!this.tryAdvanceOnReady()) this.broadcastSnapshot();
  }

  handleMessage(id: string, raw: string) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      return;
    }
    switch (msg.type) {
      case "join":
        this.handleJoin(id, msg.nickname);
        break;
      case "start":
        this.handleStart(id);
        break;
      case "setup":
        this.handleSetup(id, msg.sector, msg.name);
        break;
      case "ready":
        this.handleReady(id);
        break;
    }
  }

  // --- 입력 처리 ---

  private handleJoin(id: string, nickname: string) {
    const existing = this.state.players.find((p) => p.id === id);
    if (existing) {
      existing.nickname = nickname.trim().slice(0, 16) || existing.nickname;
      existing.connected = true;
      this.broadcastSnapshot();
      return;
    }

    if (this.state.phase !== "LOBBY") return;
    if (this.state.players.length >= ROOM.maxPlayers) return;

    const player: PlayerState = {
      id,
      nickname: nickname.trim().slice(0, 16) || "player",
      cash: 0,
      holdings: {},
      ready: false,
      connected: true,
    };
    this.state.players.push(player);
    if (!this.state.hostId) this.state.hostId = id;

    this.broadcastSnapshot();
  }

  // 호스트만, 최소 인원 충족 시: 로비 → SETUP(사업 설립).
  private handleStart(id: string) {
    if (id !== this.state.hostId) return;
    if (this.state.phase !== "LOBBY") return;
    const connected = this.state.players.filter((p) => p.connected);
    if (connected.length < ROOM.minPlayers) return;

    // 회사는 SETUP 에서 각자 만든다. 여기서는 자본만 지급하고 초기화.
    this.state.companies = {};
    for (const p of this.state.players) {
      p.cash = BALANCE.startingCash;
      p.holdings = {};
      p.ready = false;
      p.declaration = undefined;
      p.privateInfo = undefined;
      p.pendingPosition = undefined;
    }
    this.state.round = 0;
    this.state.log.push({ round: 0, text: "게임 시작 — 사업 설립" });
    this.enterPhase("SETUP");
  }

  // SETUP: 카테고리 선택 + 회사명으로 자기 사업 설립. 시작 시총은 전원 동일.
  private handleSetup(id: string, sector: Sector, name: string) {
    if (this.state.phase !== "SETUP") return;
    const player = this.state.players.find((p) => p.id === id);
    if (!player) return;
    if (!SECTORS.includes(sector)) return;

    const cleanName = name.trim().slice(0, 20) || `${player.nickname} 사`;
    this.state.companies[id] = {
      ownerId: id,
      name: cleanName,
      sector,
      price: BALANCE.startingPrice,
      techLevel: BALANCE.startingTech,
      trust: BALANCE.startingTrust,
      sharesOutstanding: SHARES_OUTSTANDING,
    };
    player.ready = true; // 설립 완료 = 준비 완료

    if (!this.tryAdvanceOnReady()) this.broadcastSnapshot();
  }

  // 현재 페이즈 입력 완료. TRADE 는 ready 를 무시(타이머만으로 전환).
  private handleReady(id: string) {
    const player = this.state.players.find((p) => p.id === id);
    if (!player) return;
    if (!ROUND_PHASES.includes(this.state.phase)) return;
    if (this.state.phase === "TRADE") return;

    player.ready = true;
    if (!this.tryAdvanceOnReady()) this.broadcastSnapshot();
  }

  // --- 페이즈 상태머신 (SPEC 2장) ---

  // 연결된 전원이 준비되면 다음으로. SETUP·라운드 페이즈(거래 제외) 공통 처리.
  private tryAdvanceOnReady(): boolean {
    const connected = this.state.players.filter((p) => p.connected);
    if (connected.length === 0) return false;

    if (this.state.phase === "SETUP") {
      // 전원이 사업 설립(회사 보유 + ready) 완료해야 1회차 시작.
      const allSetUp = connected.every(
        (p) => p.ready && this.state.companies[p.id]
      );
      if (!allSetUp) return false;
      this.state.round = 1;
      this.enterPhase("INFO");
      return true;
    }

    if (!ROUND_PHASES.includes(this.state.phase)) return false;
    if (this.state.phase === "TRADE") return false;
    if (!connected.every((p) => p.ready)) return false;
    this.advancePhase();
    return true;
  }

  private advancePhase() {
    const idx = ROUND_PHASES.indexOf(this.state.phase);
    if (idx === -1) return;

    if (idx < ROUND_PHASES.length - 1) {
      this.enterPhase(ROUND_PHASES[idx + 1]);
      return;
    }

    // SETTLE 종료 → 다음 회차 또는 게임 종료.
    if (this.state.round < this.state.maxRounds) {
      this.state.round += 1;
      this.resetRoundScopedFields();
      this.enterPhase("INFO");
    } else {
      this.endGame();
    }
  }

  private enterPhase(phase: Phase) {
    this.clearTradeTimer();
    this.state.phase = phase;
    for (const p of this.state.players) p.ready = false;

    if (phase === "TRADE") {
      const ms = BALANCE.tradeWindowSec * 1000;
      this.state.phaseDeadline = Date.now() + ms;
      this.tradeTimer = setTimeout(() => this.onTradeTimeout(), ms);
    } else {
      this.state.phaseDeadline = undefined;
    }

    this.state.log.push({ round: this.state.round, text: PHASE_LOG[phase] });
    this.broadcastSnapshot();
  }

  private onTradeTimeout() {
    if (this.state.phase !== "TRADE") return;
    this.advancePhase();
  }

  private endGame() {
    this.clearTradeTimer();
    this.state.phase = "ENDED";
    this.state.phaseDeadline = undefined;
    this.state.log.push({ round: this.state.round, text: "게임 종료" });
    this.broadcastSnapshot();
  }

  private resetRoundScopedFields() {
    for (const p of this.state.players) {
      p.declaration = undefined;
      p.privateInfo = undefined;
      p.pendingPosition = undefined;
    }
  }

  private clearTradeTimer() {
    if (this.tradeTimer) {
      clearTimeout(this.tradeTimer);
      this.tradeTimer = undefined;
    }
  }

  // --- 스냅샷 (개인화: 비공개 필드는 본인 것만) ---

  private personalizedState(viewerId: string): GameState {
    return {
      ...this.state,
      players: this.state.players.map((p) =>
        p.id === viewerId
          ? p
          : { ...p, privateInfo: undefined, pendingPosition: undefined }
      ),
    };
  }

  private sendSnapshotTo(conn: Conn) {
    const message: ServerMessage = {
      type: "snapshot",
      state: this.personalizedState(conn.id),
      selfId: conn.id,
    };
    conn.send(JSON.stringify(message));
  }

  private broadcastSnapshot() {
    for (const conn of this.conns.values()) {
      this.sendSnapshotTo(conn);
    }
  }
}
