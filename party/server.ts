import type * as Party from "partykit/server";
import { BALANCE, ROOM } from "./balance";
import { ROUND_PHASES } from "./types";
import type {
  ClientMessage,
  GameState,
  Phase,
  PlayerState,
  Sector,
  ServerMessage,
} from "./types";

const SECTORS: Sector[] = [
  "BIO",
  "TECH",
  "CONSTRUCTION",
  "LOGISTICS",
  "ENERGY",
  "FINANCE",
];

// 페이즈 진입 시 남길 로그 문구 (사람이 읽는 한 줄).
const PHASE_LOG: Record<Phase, string> = {
  INFO: "정보 페이즈 — 비공개 정보 수신",
  POSITION: "사전 포지션 페이즈 — 비공개 매매",
  DECLARE: "선언 페이즈 — 전망 카드 공개",
  TRADE: "거래 페이즈 — 제한시간 호가",
  SETTLE: "정산 페이즈 — 이벤트 발동/손익 정산",
  MANAGE: "관리 페이즈",
  LOBBY: "로비",
  ENDED: "게임 종료",
};

// 권위 서버 — SPEC.md 0장/2장/8장.
// 모든 게임 상태 계산과 페이즈 전환은 서버에서만. 클라는 입력만 보낸다.
// M2 범위: 5페이즈 상태머신을 더미 데이터로 한 회차씩 순환. 실제 손익/주가는 M3.
export default class GameServer implements Party.Server {
  state: GameState;
  private tradeTimer?: ReturnType<typeof setTimeout>;

  constructor(readonly room: Party.Room) {
    this.state = {
      roomCode: room.id,
      phase: "LOBBY",
      round: 0,
      maxRounds: ROOM.defaultMaxRounds,
      hostId: "",
      players: [],
      companies: {},
      log: [],
    };
  }

  onConnect(conn: Party.Connection) {
    // 알려진 플레이어가 같은 식별자로 다시 붙으면(재접속) 즉시 연결 상태로 복귀.
    const known = this.state.players.find((p) => p.id === conn.id);
    if (known) {
      known.connected = true;
      this.broadcastSnapshot();
      return;
    }
    // 처음 보는 연결은 아직 플레이어로 등록하지 않는다.
    // "join" 메시지에서 닉네임과 함께 등록한다.
    this.sendSnapshotTo(conn);
  }

  onClose(conn: Party.Connection) {
    const player = this.state.players.find((p) => p.id === conn.id);
    if (!player) return;
    player.connected = false;
    // 떠난 사람을 빼고 남은 전원이 ready 면 조기 전환될 수 있다.
    if (!this.tryEarlyAdvance()) this.broadcastSnapshot();
  }

  onMessage(raw: string, sender: Party.Connection) {
    let msg: ClientMessage;
    try {
      msg = JSON.parse(raw) as ClientMessage;
    } catch {
      return;
    }

    switch (msg.type) {
      case "join":
        this.handleJoin(sender.id, msg.nickname);
        break;
      case "start":
        this.handleStart(sender.id);
        break;
      case "ready":
        this.handleReady(sender.id);
        break;
    }
  }

  private handleJoin(id: string, nickname: string) {
    const existing = this.state.players.find((p) => p.id === id);
    if (existing) {
      existing.nickname = nickname.trim().slice(0, 16) || existing.nickname;
      existing.connected = true;
      this.broadcastSnapshot();
      return;
    }

    // 로비 단계에서만, 정원 내에서만 신규 입장 허용.
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

    // 첫 입장자가 호스트.
    if (!this.state.hostId) this.state.hostId = id;

    this.broadcastSnapshot();
  }

  // 호스트만, 최소 인원 충족 시: 로비 → 첫 회차 정보 페이즈.
  private handleStart(id: string) {
    if (id !== this.state.hostId) return;
    if (this.state.phase !== "LOBBY") return;
    const connected = this.state.players.filter((p) => p.connected);
    if (connected.length < ROOM.minPlayers) return;

    this.initGame();
    this.state.round = 1;
    this.state.log.push({ round: 1, text: "게임 시작" });
    this.enterPhase("INFO");
  }

  // 현재 페이즈 입력 완료. TRADE 는 ready 를 무시(타이머만으로 전환).
  private handleReady(id: string) {
    const player = this.state.players.find((p) => p.id === id);
    if (!player) return;
    if (!ROUND_PHASES.includes(this.state.phase)) return;
    if (this.state.phase === "TRADE") return;

    player.ready = true;
    if (!this.tryEarlyAdvance()) this.broadcastSnapshot();
  }

  // 연결된 전원이 ready 면(거래 제외) 타이머 전이라도 즉시 다음 페이즈로.
  private tryEarlyAdvance(): boolean {
    if (!ROUND_PHASES.includes(this.state.phase)) return false;
    if (this.state.phase === "TRADE") return false;
    const connected = this.state.players.filter((p) => p.connected);
    if (connected.length === 0) return false;
    if (!connected.every((p) => p.ready)) return false;
    this.advancePhase();
    return true;
  }

  // SPEC 2장 순서 고정. 절대 건너뛰지 않는다.
  private advancePhase() {
    const idx = ROUND_PHASES.indexOf(this.state.phase);
    if (idx === -1) return; // 회차 밖(LOBBY/ENDED 등)에서는 무시

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
      // 거래 페이즈만 타이머. 종료 시 서버가 자동 전환.
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

  // 더미 초기화: 플레이어마다 회사 하나 + 시작 자본. 실제 밸런스는 M3~M6.
  private initGame() {
    this.state.companies = {};
    this.state.players.forEach((p, i) => {
      p.cash = BALANCE.startingCash;
      p.holdings = {};
      p.ready = false;
      p.declaration = undefined;
      p.privateInfo = undefined;
      p.pendingPosition = undefined;
      this.state.companies[p.id] = {
        ownerId: p.id,
        name: `${p.nickname} 사`,
        sector: SECTORS[i % SECTORS.length],
        price: BALANCE.startingPrice,
        techLevel: BALANCE.startingTech,
        trust: BALANCE.startingTrust,
        sharesOutstanding: 1000,
      };
    });
  }

  // 회차가 바뀔 때 회차 단위 필드 초기화(ready 는 enterPhase 에서).
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

  // 플레이어별 개인화 스냅샷: 비공개 필드는 본인 것만 채워 보낸다. (SPEC 4장/8장)
  // M3 에서 privateInfo/pendingPosition 이 실제로 채워지면 이 마스킹이 동작한다.
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

  private sendSnapshotTo(conn: Party.Connection) {
    const message: ServerMessage = {
      type: "snapshot",
      state: this.personalizedState(conn.id),
      selfId: conn.id,
    };
    conn.send(JSON.stringify(message));
  }

  private broadcastSnapshot() {
    for (const conn of this.room.getConnections()) {
      this.sendSnapshotTo(conn);
    }
  }
}

GameServer satisfies Party.Worker;
