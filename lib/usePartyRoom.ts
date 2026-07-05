import { useEffect, useRef } from "react";
import PartySocket from "partysocket";
import { useGameStore } from "./store";
import { useDebugLog, summarize } from "./debugLog";
import type { ClientMessage, ServerMessage } from "@/game/types";

// 배포된 실시간 서버 호스트(Render). 환경변수가 없거나 잘못돼도 붙도록 기본값으로 둔다.
const PROD_REALTIME_HOST = "imkiing-morethanlog.onrender.com";

// 입력값에서 프로토콜/슬래시/공백을 제거해 순수 호스트만 남긴다.
function cleanHost(value: string | undefined): string {
  return (value ?? "")
    .trim()
    .replace(/^[a-z]+:\/\//i, "") // https:// wss:// 등 제거
    .replace(/\/+$/, ""); // 끝 슬래시 제거
}

// 실시간 서버 호스트 결정:
// 1) 환경변수가 있으면 그것(정리해서), 2) 브라우저가 실제 도메인이면 Render 기본값,
// 3) 그 외(로컬 개발) 127.0.0.1:1999.
function resolveRealtimeHost(): string {
  const fromEnv = cleanHost(process.env.NEXT_PUBLIC_REALTIME_HOST);
  if (fromEnv) return fromEnv;
  if (typeof window !== "undefined") {
    const h = window.location.hostname;
    if (h !== "localhost" && h !== "127.0.0.1") return PROD_REALTIME_HOST;
  }
  return "127.0.0.1:1999";
}

// 페이지 세션 동안 안정적인 플레이어 식별자.
// 네트워크가 끊겼다 붙어도(자동 재접속) 같은 id 로 같은 플레이어로 복귀한다.
// SPEC 8장: localStorage/sessionStorage 금지 → 메모리(ref)에만 보관.
function makeConnId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
}

// 방에 연결하고 서버 스냅샷을 store 에 반영한다. 입력 전송 함수를 돌려준다.
export function usePartyRoom(roomCode: string, nickname: string) {
  const socketRef = useRef<PartySocket | null>(null);
  const connIdRef = useRef<string>(makeConnId());
  const setSnapshot = useGameStore((s) => s.setSnapshot);
  const setStatus = useGameStore((s) => s.setStatus);
  const reset = useGameStore((s) => s.reset);

  useEffect(() => {
    if (!roomCode || !nickname) return;

    const host = resolveRealtimeHost();
    const dbg = useDebugLog.getState();
    setStatus("connecting");
    dbg.push({ kind: "status", text: `연결 중… (${host})` });

    const socket = new PartySocket({
      host,
      room: roomCode,
      id: connIdRef.current, // 안정적 식별자 → 재접속 시 동일 플레이어
    });
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      setStatus("connected");
      useDebugLog.getState().push({ kind: "status", text: "🟢 연결됨" });
      const join: ClientMessage = { type: "join", nickname };
      socket.send(JSON.stringify(join));
      useDebugLog.getState().push({
        kind: "send",
        text: `→ join`,
        detail: summarize(join),
      });
    });

    // partysocket 은 자동 재연결한다. 끊기면 재연결 시도 동안 connecting 으로 표시.
    socket.addEventListener("close", () => {
      setStatus("connecting");
      useDebugLog.getState().push({ kind: "status", text: "🟡 연결 끊김 · 재시도 중" });
    });
    socket.addEventListener("error", (e) => {
      setStatus("connecting");
      useDebugLog.getState().push({ kind: "error", text: "❌ WebSocket 에러", detail: String((e as unknown as Event & {message?: string})?.message ?? e) });
    });

    socket.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(event.data as string) as ServerMessage;
        if (msg.type === "snapshot") {
          setSnapshot(msg.state, msg.selfId);
          useDebugLog.getState().push({
            kind: "recv",
            text: `← snapshot ${msg.state.phase} r${msg.state.round}`,
            detail: `players=${msg.state.players.length} companies=${Object.keys(msg.state.companies).length}`,
          });
        }
      } catch (err) {
        useDebugLog
          .getState()
          .push({ kind: "error", text: "메시지 파싱 실패", detail: String(err) });
      }
    });

    return () => {
      socket.close();
      socketRef.current = null;
      reset();
    };
  }, [roomCode, nickname, setSnapshot, setStatus, reset]);

  // 모든 클라 → 서버 메시지는 이 함수를 지난다.
  // 여기서 debug 로그를 push 하므로 UI의 모든 버튼 클릭이 자동으로 기록된다.
  function send(message: ClientMessage) {
    const socket = socketRef.current;
    const dbg = useDebugLog.getState();
    if (!socket) {
      dbg.push({
        kind: "error",
        text: `→ ${message.type} 전송 실패 · 소켓 없음`,
      });
      return;
    }
    if (socket.readyState !== 1 /* OPEN */) {
      dbg.push({
        kind: "error",
        text: `→ ${message.type} 전송 실패 · 연결 안 됨 (state=${socket.readyState})`,
      });
      return;
    }
    try {
      socket.send(JSON.stringify(message));
      dbg.push({
        kind: "send",
        text: `→ ${message.type}`,
        detail: summarize(message),
      });
    } catch (err) {
      dbg.push({
        kind: "error",
        text: `→ ${message.type} 전송 실패`,
        detail: String(err),
      });
    }
  }

  return { send };
}
