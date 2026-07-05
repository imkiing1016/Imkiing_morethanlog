"use client";

import { usePartyRoom } from "@/lib/usePartyRoom";
import { useGameStore } from "@/lib/store";
import Lobby from "./Lobby";
import GameView from "./GameView";
import DebugPanel from "./DebugPanel";
import NewsFeed from "./NewsFeed";

// 방 컨테이너: 소켓 연결을 한 곳에서 유지하고(페이즈가 바뀌어도 재연결 안 함),
// 서버가 내려준 phase 에 따라 화면만 바꾼다. 전환 결정은 전적으로 서버.
export default function Room({
  roomCode,
  nickname,
}: {
  roomCode: string;
  nickname: string;
}) {
  const { send } = usePartyRoom(roomCode, nickname);
  const state = useGameStore((s) => s.state);

  return (
    <>
      {!state ? (
        <main className="flex flex-col gap-4 pt-12">
          <p className="text-sm text-neutral">방에 연결하는 중…</p>
        </main>
      ) : state.phase === "LOBBY" ? (
        <Lobby roomCode={roomCode} send={send} />
      ) : (
        <GameView send={send} />
      )}
      <NewsFeed />
      <DebugPanel />
    </>
  );
}
