"use client";

import { useState } from "react";
import { usePartyRoom } from "@/lib/usePartyRoom";
import { useGameStore } from "@/lib/store";
import { ROOM } from "@/party/balance";

// 로비: 플레이어 목록 / 링크 공유 / 호스트 시작. (SPEC M1)
// M0 범위에서는 입장과 목록 표시까지 동작. 시작 버튼은 M2에서 페이즈에 연결된다.
export default function Lobby({
  roomCode,
  nickname,
}: {
  roomCode: string;
  nickname: string;
}) {
  const { send } = usePartyRoom(roomCode, nickname);
  const state = useGameStore((s) => s.state);
  const selfId = useGameStore((s) => s.selfId);
  const [copied, setCopied] = useState(false);

  function copyLink() {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}/room/${roomCode}`;
    void navigator.clipboard.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }

  if (!state) {
    return (
      <main className="flex flex-col gap-4 pt-12">
        <p className="text-sm text-neutral">방에 연결하는 중…</p>
      </main>
    );
  }

  const connected = state.players.filter((p) => p.connected);
  const isHost = selfId !== null && selfId === state.hostId;
  const canStart = connected.length >= ROOM.minPlayers;

  return (
    <main className="flex flex-col gap-6 pt-8">
      <header className="flex flex-col gap-1">
        <p className="text-sm text-neutral">방 코드</p>
        <div className="flex items-center justify-between">
          <p className="text-2xl font-medium tracking-widest">{roomCode}</p>
          <button
            onClick={copyLink}
            className="rounded-element border border-ink px-3 py-2 text-sm font-medium"
          >
            {copied ? "복사됨" : "링크 공유"}
          </button>
        </div>
      </header>

      <section className="flex flex-col gap-2">
        <p className="text-sm text-neutral">
          플레이어 {connected.length} / {ROOM.maxPlayers}
        </p>
        <ul className="flex flex-col gap-2">
          {state.players.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-element border border-neutral/20 px-3 py-3"
            >
              <span className="font-medium">
                {p.nickname}
                {p.id === selfId && (
                  <span className="ml-2 text-sm text-neutral">(나)</span>
                )}
              </span>
              <span className="text-sm text-neutral">
                {p.id === state.hostId ? "호스트" : ""}
                {!p.connected ? " · 연결 끊김" : ""}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {isHost ? (
        <button
          disabled={!canStart}
          onClick={() => send({ type: "start" })}
          className="rounded-element bg-success px-4 py-3 text-paper font-medium disabled:opacity-40"
        >
          {canStart
            ? "게임 시작"
            : `최소 ${ROOM.minPlayers}명 필요`}
        </button>
      ) : (
        <p className="text-sm text-neutral">호스트가 시작하기를 기다리는 중…</p>
      )}
    </main>
  );
}
