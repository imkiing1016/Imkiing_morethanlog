"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

// 랜딩: 방 생성 / 코드로 입장. (SPEC M1)
// 사람이 읽고 부르기 쉬운 6자리. 혼동되는 글자(0/O, 1/I/L) 제외.
function makeRoomCode(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function Home() {
  const router = useRouter();
  const [joinCode, setJoinCode] = useState("");

  function createRoom() {
    router.push(`/room/${makeRoomCode()}`);
  }

  function joinRoom() {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) return;
    router.push(`/room/${code}`);
  }

  return (
    <main className="flex flex-col gap-8 pt-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-2xl font-medium">블러핑 주식게임</h1>
        <p className="text-sm text-neutral">
          내가 아는 미래 정보를 진실 혹은 뻥카로 흘려 남을 끌어들이는 멀티플레이어 게임.
        </p>
      </header>

      <button
        onClick={createRoom}
        className="rounded-element bg-success px-4 py-3 text-paper font-medium"
      >
        새 방 만들기
      </button>

      <div className="flex flex-col gap-2">
        <label htmlFor="code" className="text-sm text-neutral">
          코드로 입장
        </label>
        <div className="flex gap-2">
          <input
            id="code"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value)}
            placeholder="방 코드"
            maxLength={6}
            className="flex-1 rounded-element border border-neutral/30 px-3 py-3 uppercase tracking-widest"
          />
          <button
            onClick={joinRoom}
            className="rounded-element border border-ink px-4 py-3 font-medium"
          >
            입장
          </button>
        </div>
      </div>
    </main>
  );
}
