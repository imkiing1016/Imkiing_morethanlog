import { useEffect, useRef } from "react";
import PartySocket from "partysocket";
import { useGameStore } from "./store";
import type { ClientMessage, ServerMessage } from "@/party/types";

const PARTYKIT_HOST =
  process.env.NEXT_PUBLIC_PARTYKIT_HOST ?? "127.0.0.1:1999";

// 방에 연결하고 서버 스냅샷을 store 에 반영한다. 입력 전송 함수를 돌려준다.
export function usePartyRoom(roomCode: string, nickname: string) {
  const socketRef = useRef<PartySocket | null>(null);
  const setSnapshot = useGameStore((s) => s.setSnapshot);
  const setStatus = useGameStore((s) => s.setStatus);
  const reset = useGameStore((s) => s.reset);

  useEffect(() => {
    if (!roomCode || !nickname) return;

    setStatus("connecting");
    const socket = new PartySocket({
      host: PARTYKIT_HOST,
      room: roomCode,
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
