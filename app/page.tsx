"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import AvatarView from "@/components/Avatar";
import AvatarEditor from "@/components/AvatarEditor";
import { defaultAvatar, loadAvatar, saveAvatar } from "@/lib/avatarStorage";
import type { Avatar } from "@/game/types";

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
  const [avatar, setAvatar] = useState<Avatar>(defaultAvatar);
  const [showEditor, setShowEditor] = useState(false);

  // 저장된 아바타 불러오기 (SSR 시 window 없음 → 마운트 후).
  useEffect(() => {
    setAvatar(loadAvatar());
  }, []);

  function updateAvatar(next: Avatar) {
    setAvatar(next);
    saveAvatar(next);
  }

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
        <h1 className="text-2xl font-medium">인생여전 &amp; 역전</h1>
        <p className="text-sm text-neutral">
          내가 아는 미래 정보를 진실 혹은 뻥카로 흘려 남을 끌어들이는 멀티플레이어 게임.
        </p>
      </header>

      {/* 캐릭터 커스터마이징 카드 */}
      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <p className="text-sm text-neutral">🎭 내 캐릭터</p>
          <button
            onClick={() => setShowEditor((v) => !v)}
            className="text-xs rounded-element border border-cardEdge bg-card px-2 py-1"
          >
            {showEditor ? "접기" : "커스터마이징"}
          </button>
        </div>
        {showEditor ? (
          <AvatarEditor value={avatar} onChange={updateAvatar} />
        ) : (
          <button
            onClick={() => setShowEditor(true)}
            className="rounded-card border-2 border-cardEdge bg-card px-3 py-3 flex items-center gap-3"
            aria-label="아바타 편집"
          >
            <div className="rounded-full border-2 border-cardEdge bg-paper w-14 h-14 flex items-center justify-center overflow-hidden">
              <AvatarView avatar={avatar} size={48} />
            </div>
            <div className="text-left flex-1">
              <p className="text-sm font-medium">내 캐릭터 프리뷰</p>
              <p className="text-xs text-neutral">
                눌러서 얼굴 · 피부색 · 표정 · 손그림 편집
              </p>
            </div>
            <span className="text-neutral text-xs">›</span>
          </button>
        )}
      </section>

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
