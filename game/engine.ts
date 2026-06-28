import { BALANCE, ROOM } from "./balance";
import { ROUND_PHASES, SECTORS } from "./types";
import type {
  ClientMessage,
  Declaration,
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
        this.handleSetup(id, msg.sector, msg.name, msg.seedInvested);
        break;
      case "declare":
        this.handleDeclare(id, msg.declaration);
        break;
      case "ready":
        this.handleReady(id);
        break;
    }
  }

  // SPEC 2장 ③: HYPE/WARN/SILENT 1장 선언 + 준비 처리.
  private handleDeclare(id: string, declaration: Declaration) {
    if (this.state.phase !== "DECLARE") return;
    const player = this.state.players.find((p) => p.id === id);
    if (!player) return;
    if (
      declaration !== "HYPE" &&
      declaration !== "WARN" &&
      declaration !== "SILENT"
    ) {
      return;
    }
    player.declaration = declaration;
    player.ready = true;
    if (!this.tryAdvanceOnReady()) this.broadcastSnapshot();
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
      seedInvested: 0,
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
      p.seedInvested = 0;
    }
    this.state.round = 0;
    this.state.log.push({ round: 0, text: "게임 시작 — 사업 설립" });
    this.enterPhase("SETUP");
  }

  // SETUP: 카테고리 + 회사명 + 창업 출자(seedInvested).
  // 시작 시총은 전원 동일(price × shares). 출자는 시총이 아니라 정산 시 성장 보너스로 환원된다.
  private handleSetup(
    id: string,
    sector: Sector,
    name: string,
    seedInvested: number
  ) {
    if (this.state.phase !== "SETUP") return;
    const player = this.state.players.find((p) => p.id === id);
    if (!player) return;
    if (!SECTORS.includes(sector)) return;

    // 출자 금액: 0 ~ seedInvestedMax 사이로 정수 클램프.
    const seed = Math.max(
      0,
      Math.min(BALANCE.seedInvestedMax, Math.floor(Number(seedInvested) || 0))
    );

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
    // 시작 자본에서 출자분만큼 차감(회차 1 시작 시 현금에 반영).
    player.cash = BALANCE.startingCash - seed;
    player.seedInvested = seed;
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

    if (phase === "INFO") this.onEnterInfo();
    if (phase === "SETTLE") this.onEnterSettle();

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

  // SPEC 2장 ①: 각자에게 자기 섹터 다음 이벤트 방향만 비공개로 지급. 강도는 SETTLE에서 결정.
  private onEnterInfo() {
    for (const p of this.state.players) {
      p.privateInfo = Math.random() < 0.5 ? "BULLISH" : "BEARISH";
      p.declaration = undefined;
    }
  }

  // SPEC 2장 ⑤ + 1.1: 이벤트 발동(주가 ±), 창업 출자 성장 보너스, 신뢰도 ±1.
  // 매매·포지션 체결은 후반부(M3b)에서 추가.
  private onEnterSettle() {
    for (const p of this.state.players) {
      const co = this.state.companies[p.id];
      if (!co) continue;

      // 이벤트 강도 랜덤. 방향은 본인 privateInfo.
      const [lo, hi] = BALANCE.eventMagnitudeRange;
      const mag = lo + Math.random() * (hi - lo);
      const dir = p.privateInfo ?? "BULLISH";
      const eventDelta = dir === "BULLISH" ? mag : -mag;

      // 창업 출자 성장 보너스: 풀출자(seedInvestedMax)면 +seedGrowthMax, 비례.
      const seedRatio =
        BALANCE.seedInvestedMax > 0
          ? Math.min(1, p.seedInvested / BALANCE.seedInvestedMax)
          : 0;
      const seedBonus = BALANCE.seedGrowthMax * seedRatio;

      const prevPrice = co.price;
      // 합성 변동: 이벤트 + 성장보너스(둘 다 비율). 합쳐서 곱.
      co.price = Math.max(
        1,
        Math.round(prevPrice * (1 + eventDelta + seedBonus))
      );

      // 신뢰도 ±1: 선언 == 실제 → +1, SILENT는 변동 없음, 다르면 −1.
      let trustDelta = 0;
      if (p.declaration === "SILENT") trustDelta = 0;
      else if (p.declaration === "HYPE")
        trustDelta = dir === "BULLISH" ? 1 : -1;
      else if (p.declaration === "WARN")
        trustDelta = dir === "BEARISH" ? 1 : -1;
      co.trust = Math.max(0, Math.min(5, co.trust + trustDelta));

      // 사람이 읽는 한 줄 로그.
      const pct = ((co.price / prevPrice - 1) * 100).toFixed(1);
      const dirLabel = dir === "BULLISH" ? "호재" : "악재";
      this.state.log.push({
        round: this.state.round,
        text: `${co.name}: ${dirLabel} ${pct}% (신뢰도 ${trustDelta >= 0 ? "+" : ""}${trustDelta})`,
      });
    }
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
