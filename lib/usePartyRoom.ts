import { useEffect, useRef } from "react";
import PartySocket from "partysocket";
import { useGameStore } from "./store";
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

    setStatus("connecting");
    const socket = new PartySocket({
      host: resolveRealtimeHost(),
      room: roomCode,
      id: connIdRef.current, // 안정적 식별자 → 재접속 시 동일 플레이어
    });
    socketRef.current = socket;

    socket.addEventListener("open", () => {
      setStatus("connected");
      const join: ClientMessage = { type: "join", nickname };
      socket.send(JSON.stringify(join));
    });

    // partysocket 은 자동 재연결한다. 끊기면 재연결 시도 동안 connecting 으로 표시.
    socket.addEventListener("close", () => setStatus("connecting"));
    socket.addEventListener("error", () => setStatus("connecting"));

    socket.addEventListener("message", (event) => {
      try {
        const msg = JSON.parse(event.data as string) as ServerMessage;
        if (msg.type === "snapshot") {
          setSnapshot(msg.state, msg.selfId);
        }
      } catch {
        // 무시: 알 수 없는 메시지
      }
    });

    return () => {
      socket.close();
      socketRef.current = null;
      reset();
    };
  }, [roomCode, nickname, setSnapshot, setStatus, reset]);

  function send(message: ClientMessage) {
    socketRef.current?.send(JSON.stringify(message));
  }

  return { send };
}
