"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Room from "@/components/Room";

// 방 컨테이너: 닉네임 입력 후 로비에 합류. (SPEC M0~M1)
export default function RoomPage() {
  const params = useParams();
  const code = String(params.code ?? "").toUpperCase();
  const [nickname, setNickname] = useState("");
  const [joined, setJoined] = useState(false);

  if (!joined) {
    return (
      <main className="flex flex-col gap-6 pt-12">
        <header className="flex flex-col gap-1">
          <p className="text-sm text-neutral">방 코드</p>
          <p className="text-2xl font-medium tracking-widest">{code}</p>
        </header>

        <div className="flex flex-col gap-2">
          <label htmlFor="nick" className="text-sm text-neutral">
            닉네임
          </label>
          <input
            id="nick"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="이름을 입력하세요"
            maxLength={16}
            className="rounded-element border border-neutral/30 px-3 py-3"
          />
        </div>

        <button
          disabled={nickname.trim().length === 0}
          onClick={() => setJoined(true)}
          className="rounded-element bg-success px-4 py-3 text-paper font-medium disabled:opacity-40"
        >
          입장하기
        </button>
      </main>
    );
  }

  return <Room roomCode={code} nickname={nickname.trim()} />;
}
