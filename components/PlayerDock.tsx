"use client";

import { useEffect, useRef, useState } from "react";
import { ROOM } from "@/game/balance";
import { EMOTE_EMOJI, EMOTE_KINDS, EMOTE_LABEL } from "@/game/types";
import type {
  ActiveEmote,
  ClientMessage,
  EmoteKind,
  GameState,
} from "@/game/types";
import SectorIcon from "./SectorIcon";
import Avatar from "./Avatar";
import EmoteBalloon from "./EmoteBalloon";

// 하단 플레이어 Dock — 최대 6칸 (실제 참여자 뒤엔 빈 슬롯 회색 비활성).
// 자신 슬롯 탭 → 이모트 팔레트 팝오버 → 하나 선택 → 서버 브로드캐스트.
// 3초 이내 5회 이상 발신 시 클라 자체 쿨다운 8초 + "너무 많은 메시지" 하단 안내.
// 접기 버튼: 접힘 시 얇은 바만 남기고 메인 화면 공간 확보. 켜둔 상태는 스크롤에도 fixed 고정.

const RATE_LIMIT_WINDOW_MS = 3000;
const RATE_LIMIT_MAX = 5;
const RATE_COOLDOWN_MS = 8000;

export default function PlayerDock({
  state,
  selfId,
  send,
}: {
  state: GameState;
  selfId: string | null;
  send: (msg: ClientMessage) => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const sendHistoryRef = useRef<number[]>([]);
  const cooldownUntilRef = useRef(0);
  const [, setTick] = useState(0); // 애니메이션 재렌더용

  // 이모트 만료 자동 리렌더
  useEffect(() => {
    if (!state.activeEmotes || state.activeEmotes.length === 0) return;
    const t = setInterval(() => setTick((n) => n + 1), 300);
    return () => clearInterval(t);
  }, [state.activeEmotes]);

  // 경고 문구 자동 사라짐
  useEffect(() => {
    if (!warning) return;
    const t = setTimeout(() => setWarning(null), 3500);
    return () => clearTimeout(t);
  }, [warning]);

  function trySendEmote(kind: EmoteKind) {
    const now = Date.now();
    if (now < cooldownUntilRef.current) {
      const secLeft = Math.ceil((cooldownUntilRef.current - now) / 1000);
      setWarning(`너무 많은 메시지를 보냅니다. ${secLeft}초 후 다시 시도.`);
      return;
    }
    sendHistoryRef.current = sendHistoryRef.current.filter(
      (t) => now - t <= RATE_LIMIT_WINDOW_MS
    );
    if (sendHistoryRef.current.length >= RATE_LIMIT_MAX) {
      cooldownUntilRef.current = now + RATE_COOLDOWN_MS;
      sendHistoryRef.current = [];
      setWarning("너무 많은 메시지를 보냅니다. 잠시 후 다시 시도해주세요.");
      setPickerOpen(false);
      return;
    }
    sendHistoryRef.current.push(now);
    send({ type: "sendEmote", kind });
    setPickerOpen(false);
  }

  const maxSlots = ROOM.maxPlayers; // 6
  const players = state.players.slice(0, maxSlots);
  const emptySlots = Math.max(0, maxSlots - players.length);

  // 접힘 상태에서는 아이콘 얇은 바만 표시
  if (collapsed) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-30 flex justify-center">
        <button
          onClick={() => setCollapsed(false)}
          className="rounded-t-card border-2 border-b-0 border-cardEdge bg-card px-4 py-1.5 text-xs shadow-md"
          aria-label="플레이어 Dock 펼치기"
        >
          ▲ 플레이어 · 이모트
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 flex flex-col items-center pointer-events-none">
      {/* 자기 하단 경고 문구 (자기만 보임) */}
      {warning && (
        <div className="pointer-events-auto mb-1 px-3 py-1.5 rounded-element bg-danger/90 text-paper text-xs shadow-lg">
          ⚠️ {warning}
        </div>
      )}

      {/* 이모트 팔레트 (자기 슬롯 탭 시 표시) */}
      {pickerOpen && (
        <div className="pointer-events-auto mb-2 flex gap-2 rounded-card border-2 border-cardEdge bg-card px-3 py-2 shadow-lg animate-fadein">
          {EMOTE_KINDS.map((k) => (
            <button
              key={k}
              onClick={() => trySendEmote(k)}
              className="flex flex-col items-center gap-0.5 px-2 py-1 rounded-element hover:bg-accentSoft active:scale-95 transition"
            >
              <span className="text-2xl">{EMOTE_EMOJI[k]}</span>
              <span className="text-[10px] text-neutral">{EMOTE_LABEL[k]}</span>
            </button>
          ))}
          <button
            onClick={() => setPickerOpen(false)}
            className="text-xs text-neutral px-2"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
      )}

      {/* Dock 본체 */}
      <div className="pointer-events-auto w-full max-w-3xl mx-auto rounded-t-card border-2 border-b-0 border-cardEdge bg-card px-2 pt-2 pb-1 shadow-lg">
        <div className="flex items-center gap-1.5">
          {players.map((p, idx) => {
            const co = state.companies[p.id];
            const isSelf = p.id === selfId;
            const activeEmote = (state.activeEmotes ?? [])
              .filter((e) => e.playerId === p.id)
              .slice(-1)[0] as ActiveEmote | undefined;
            return (
              <button
                key={p.id}
                onClick={() => isSelf && setPickerOpen((o) => !o)}
                disabled={!isSelf}
                title={
                  isSelf
                    ? "탭 해서 감정 표현"
                    : `${p.nickname}${co ? ` · ${co.name}` : ""}`
                }
                className={`flex-1 relative rounded-element border-2 px-1 py-2 flex flex-col items-center gap-0.5 min-w-0 transition ${
                  isSelf
                    ? "border-warning bg-accentSoft active:scale-95 cursor-pointer"
                    : "border-cardEdge bg-paper cursor-default"
                } ${!p.connected ? "opacity-50" : ""}`}
                aria-label={`플레이어 ${idx + 1}: ${p.nickname}`}
              >
                {/* 이모트 풍선 */}
                {activeEmote && <EmoteBalloon emote={activeEmote} />}
                {/* 아바타(우선) → 없으면 섹터/투자자/기본 이모지 */}
                <div className="relative">
                  {p.avatar &&
                  (p.avatar.drawingDataUrl ||
                    p.avatar.face !== undefined ||
                    p.avatar.emotion !== undefined) ? (
                    <Avatar avatar={p.avatar} size={30} />
                  ) : co ? (
                    <SectorIcon sector={co.sector} size={28} />
                  ) : p.isInvestor ? (
                    <span className="text-2xl">💼</span>
                  ) : (
                    <span className="text-2xl">👤</span>
                  )}
                  {/* 접속 상태 점 */}
                  <span
                    className={`absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border border-card ${
                      p.connected ? "bg-success" : "bg-neutral"
                    }`}
                    aria-hidden
                  />
                </div>
                {/* 닉네임 (자기는 초록 강조) */}
                <span
                  className={`text-[10px] truncate max-w-full leading-tight ${
                    isSelf ? "text-warning font-medium" : ""
                  }`}
                >
                  {p.nickname}
                  {p.isBot && " 🤖"}
                </span>
                {/* 준비 완료 여부 */}
                {p.ready && (
                  <span className="text-[9px] text-success leading-none">
                    ✓ 준비
                  </span>
                )}
              </button>
            );
          })}
          {/* 빈 슬롯 (회색 비활성) */}
          {Array.from({ length: emptySlots }).map((_, i) => (
            <div
              key={`empty-${i}`}
              className="flex-1 rounded-element border-2 border-dashed border-cardEdge/40 bg-paper/40 px-1 py-2 flex flex-col items-center gap-0.5 min-w-0"
              aria-hidden
            >
              <span className="text-2xl opacity-30">·</span>
              <span className="text-[10px] text-neutral/50 leading-tight">
                빈 자리
              </span>
            </div>
          ))}
        </div>
        {/* 접기 버튼 */}
        <div className="flex justify-center">
          <button
            onClick={() => setCollapsed(true)}
            className="text-[10px] text-neutral py-0.5"
            aria-label="플레이어 Dock 접기"
          >
            ▼ 접기
          </button>
        </div>
      </div>
    </div>
  );
}
