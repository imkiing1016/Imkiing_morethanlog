"use client";

import type { GameState, Phase } from "@/game/types";

// 회차 진행 바 — 1/N 라운드 진행률 슬라이더 + 이벤트 배지/문구.
// 이벤트가 예약되면(pendingLeverage/pendingBigEvent) 라벨 스트링 표시,
// 그에 맞춰 세로 크기 확장 (기본 얇음).
const PHASE_LABEL: Record<Phase, string> = {
  LOBBY: "로비",
  SETUP: "사업 설립",
  INFO: "정보",
  POSITION: "포지션",
  DECLARE: "선언",
  TRADE: "거래",
  SETTLE: "정산",
  MANAGE: "관리",
  ENDED: "종료",
};

export default function RoundProgressBar({ state }: { state: GameState }) {
  const totalRounds = state.maxRounds || 1;
  const progress =
    state.round > 0 ? Math.min(1, state.round / totalRounds) : 0;
  const pct = (progress * 100).toFixed(1);

  const hasLeverage = !!state.pendingLeverage;
  const hasBigEvent = !!state.pendingBigEvent;
  const hasEvent = hasLeverage || hasBigEvent;

  return (
    <section
      className={`rounded-card border-2 border-cardEdge bg-card px-3 py-2 flex flex-col gap-1.5 transition-all ${
        hasEvent ? "border-warning" : ""
      }`}
    >
      {/* 회차 · 페이즈 라벨 */}
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-neutral tabular-nums">
          {state.round > 0
            ? `회차 ${state.round} / ${totalRounds}`
            : "게임 시작 전"}
        </span>
        <span className="font-medium">
          {PHASE_LABEL[state.phase]}
        </span>
      </div>

      {/* 프로그레스 슬라이더 */}
      <div
        className="relative h-2 rounded-full bg-paper border border-cardEdge overflow-hidden"
        role="progressbar"
        aria-valuenow={state.round}
        aria-valuemin={0}
        aria-valuemax={totalRounds}
      >
        <div
          className="h-full bg-gradient-to-r from-info via-warning to-danger transition-all"
          style={{ width: `${pct}%` }}
        />
        {/* 회차 눈금 (매 회차마다 세로선) */}
        <div className="absolute inset-0 flex">
          {Array.from({ length: totalRounds }).map((_, i) => (
            <div
              key={i}
              className="flex-1 border-r border-cardEdge/40 last:border-r-0"
            />
          ))}
        </div>
      </div>

      {/* 이벤트 배지 · 스트링 (있을 때만, 세로 크기 자동 확장) */}
      {hasEvent && (
        <div className="flex flex-wrap gap-1.5 pt-1 border-t border-cardEdge/50">
          {hasLeverage && (
            <span className="rounded-element bg-warning/20 border border-warning px-2 py-1 text-xs font-medium text-warning animate-pulse flex-1 min-w-max">
              🎢 <b>레버리지 데이</b> · 이번 회차 최종 변동률 ×
              {state.pendingLeverage}
            </span>
          )}
          {hasBigEvent && (
            <span className="rounded-element bg-danger/15 border border-danger px-2 py-1 text-xs font-medium text-danger animate-pulse flex-1 min-w-max">
              {state.pendingBigEvent!.emoji} <b>{state.pendingBigEvent!.label}</b>
              {" · "}블랙스완 임박
            </span>
          )}
        </div>
      )}
    </section>
  );
}
