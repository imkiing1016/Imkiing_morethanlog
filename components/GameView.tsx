"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/store";
import type { ClientMessage, Phase } from "@/game/types";

// M2 임시 화면: 5페이즈 상태머신 검증용 최소 UI. 진짜 화면은 M4.
// 서버가 내려준 phase/round/log/phaseDeadline 을 그릴 뿐, 전환은 서버가 결정.

const PHASE_LABEL: Record<Phase, string> = {
  INFO: "정보",
  POSITION: "사전 포지션",
  DECLARE: "선언",
  TRADE: "거래",
  SETTLE: "정산",
  MANAGE: "관리",
  LOBBY: "로비",
  ENDED: "종료",
};

// SPEC 5장 페이즈별 액센트 색.
const PHASE_ACCENT: Record<Phase, string> = {
  INFO: "text-danger",
  POSITION: "text-danger",
  DECLARE: "text-warning",
  TRADE: "text-success",
  SETTLE: "text-info",
  MANAGE: "text-neutral",
  LOBBY: "text-neutral",
  ENDED: "text-neutral",
};

export default function GameView({
  send,
}: {
  send: (message: ClientMessage) => void;
}) {
  const state = useGameStore((s) => s.state);
  const selfId = useGameStore((s) => s.selfId);

  // 거래 페이즈 카운트다운 표시용(렌더 전용, 게임 계산 아님).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  if (!state) return null;

  const self = state.players.find((p) => p.id === selfId);
  const isTrade = state.phase === "TRADE";
  const isEnded = state.phase === "ENDED";
  const connected = state.players.filter((p) => p.connected);
  const readyCount = connected.filter((p) => p.ready).length;

  const secondsLeft =
    isTrade && state.phaseDeadline
      ? Math.max(0, Math.ceil((state.phaseDeadline - now) / 1000))
      : null;

  const recentLog = state.log.slice(-6).reverse();

  return (
    <main className="flex flex-col gap-6 pt-8">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          <p className="text-sm text-neutral">
            회차 {state.round} / {state.maxRounds}
          </p>
          <p className={`text-2xl font-medium ${PHASE_ACCENT[state.phase]}`}>
            {PHASE_LABEL[state.phase]} 페이즈
          </p>
        </div>
        {secondsLeft !== null && (
          <span className="text-2xl font-medium text-success tabular-nums">
            {secondsLeft}s
          </span>
        )}
      </header>

      {isEnded ? (
        <section className="rounded-card border border-neutral/20 p-4">
          <p className="font-medium">게임 종료</p>
          <p className="text-sm text-neutral">
            마지막 회차까지 순환을 마쳤습니다. (승리화면은 M7)
          </p>
        </section>
      ) : isTrade ? (
        <section className="flex flex-col gap-2 rounded-card border border-success/30 p-4">
          <p className="font-medium text-success">거래 진행 중</p>
          <p className="text-sm text-neutral">
            제한시간이 끝나면 서버가 자동으로 정산 페이즈로 넘어갑니다. (실제 호가는 M3)
          </p>
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          <p className="text-sm text-neutral">
            준비 완료 {readyCount} / {connected.length}
          </p>
          <button
            disabled={self?.ready}
            onClick={() => send({ type: "ready" })}
            className="rounded-element bg-success px-4 py-3 text-paper font-medium disabled:opacity-40"
          >
            {self?.ready ? "준비됨 · 다른 사람 대기 중" : "준비 완료"}
          </button>
          <p className="text-xs text-neutral">
            전원이 준비하면 타이머 없이 바로 다음 페이즈로 넘어갑니다.
          </p>
        </section>
      )}

      <section className="flex flex-col gap-2">
        <p className="text-sm text-neutral">플레이어</p>
        <ul className="flex flex-col gap-1">
          {state.players.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-element border border-neutral/20 px-3 py-2 text-sm"
            >
              <span className="font-medium">
                {p.nickname}
                {p.id === selfId && (
                  <span className="ml-2 text-neutral">(나)</span>
                )}
              </span>
              <span className="text-neutral">
                {!p.connected
                  ? "연결 끊김"
                  : isTrade
                    ? "거래 중"
                    : p.ready
                      ? "준비됨"
                      : "대기"}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <p className="text-sm text-neutral">진행 로그</p>
        <ul className="flex flex-col gap-1">
          {recentLog.map((entry, i) => (
            <li key={i} className="text-sm">
              <span className="text-neutral">R{entry.round} · </span>
              {entry.text}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
