import http from "node:http";
import { randomUUID } from "node:crypto";
import { WebSocketServer } from "ws";
import type { WebSocket } from "ws";
import { GameRoom, type Conn } from "../game/engine";

// 자체 호스팅 실시간 서버 — SPEC 0장. 방 1판 = GameRoom 1개(roomCode 키, 서버 메모리).
// 클라(partysocket)는 wss://<host>/parties/main/<room>?_pk=<id> 로 접속한다.

const PORT = Number(process.env.PORT ?? 1999);
const rooms = new Map<string, GameRoom>();
const emptyTimers = new Map<string, ReturnType<typeof setTimeout>>();
const EMPTY_ROOM_TTL_MS = 5 * 60 * 1000; // 빈 방은 5분 뒤 메모리에서 정리

// 진단용: 이 서버 빌드가 어떤 기능을 지원하는지 노출.
// 새 커밋 배포 후 여기 항목이 늘어야 클라에서 그 메시지가 통한다.
const SUPPORTED_MESSAGES = [
  "join",
  "start",
  "addBot",
  "setup",
  "buyInfo",
  "submitPosition",
  "trade",
  "declare",
  "techUpgrade",
  "research",
  "pivot",
  "listExit",
  "bidExit",
  "rematch",
  "ready",
];
const STARTED_AT = new Date().toISOString();

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  if (url.pathname === "/version") {
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    res.end(
      JSON.stringify({
        ok: true,
        supported: SUPPORTED_MESSAGES,
        startedAt: STARTED_AT,
      })
    );
    return;
  }
  // 헬스체크(Render 등) + 안내 응답.
  res.writeHead(200, { "content-type": "text/plain; charset=utf-8" });
  res.end(
    `bluffing-stock-game realtime server: ok\nsupports: ${SUPPORTED_MESSAGES.join(", ")}`
  );
});

const wss = new WebSocketServer({ noServer: true });

server.on("upgrade", (req, socket, head) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  // 경로: /parties/main/<room>
  const segments = url.pathname.split("/").filter(Boolean);
  const roomCode = segments[2];
  const id = url.searchParams.get("_pk") ?? randomUUID();

  if (!roomCode) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    handleConnection(ws, roomCode, id);
  });
});

function handleConnection(ws: WebSocket, roomCode: string, id: string) {
  let room = rooms.get(roomCode);
  if (!room) {
    room = new GameRoom(roomCode);
    rooms.set(roomCode, room);
  }
  // 방이 비어 삭제 예약돼 있었다면 취소.
  const pending = emptyTimers.get(roomCode);
  if (pending) {
    clearTimeout(pending);
    emptyTimers.delete(roomCode);
  }

  const conn: Conn = {
    id,
    send: (data) => {
      if (ws.readyState === ws.OPEN) ws.send(data);
    },
  };
  room.addConn(conn);

  ws.on("message", (data) => room!.handleMessage(id, data.toString()));

  ws.on("close", () => {
    room!.removeConn(conn);
    if (room!.connectionCount === 0) {
      const timer = setTimeout(() => {
        rooms.delete(roomCode);
        emptyTimers.delete(roomCode);
      }, EMPTY_ROOM_TTL_MS);
      emptyTimers.set(roomCode, timer);
    }
  });
}

server.listen(PORT, () => {
  console.log(`realtime server listening on :${PORT}`);
});
