import type * as Party from "partykit/server";
import { ROOM } from "./balance";
import type {
  ClientMessage,
  GameState,
  PlayerState,
  ServerMessage,
} from "./types";

// 권위 서버 — SPEC.md 0장/8장.
// 모든 게임 상태 계산은 서버에서만. 클라는 입력만 보내고 스냅샷을 그린다.
// M0 범위: 빈 방 생성/입장. phase 는 LOBBY 에 고정한다(전환은 M2부터).
export default class GameServer implements Party.Server {
  state: GameState;

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
    // 연결만으로는 플레이어로 등록하지 않는다. "join" 메시지에서 닉네임과 함께 등록.
    this.sendSnapshotTo(conn);
  }

  onClose(conn: Party.Connection) {
    const player = this.state.players.find((p) => p.id === conn.id);
    if (!player) return;
    player.connected = false;
    this.broadcastSnapshot();
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
      connected: true,
    };
    this.state.players.push(player);

    // 첫 입장자가 호스트.
    if (!this.state.hostId) this.state.hostId = id;

    this.broadcastSnapshot();
  }

  private handleStart(id: string) {
    // 호스트만, 최소 인원 충족 시. (M0: 상태 전환은 아직 구현하지 않음)
    if (id !== this.state.hostId) return;
    const connectedCount = this.state.players.filter((p) => p.connected).length;
    if (connectedCount < ROOM.minPlayers) return;
    // M2에서 페이즈 상태머신을 연결한다. 현재는 로그만 남긴다.
    this.state.log.push({ round: 0, text: "host requested start (pending M2)" });
    this.broadcastSnapshot();
  }

  // 플레이어별 개인화 스냅샷: 비공개 필드는 본인 것만 채워 보낸다. (SPEC 4장/8장)
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
