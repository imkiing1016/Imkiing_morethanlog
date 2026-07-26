"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/store";
import type { ClientMessage } from "@/game/types";
import TopBar from "./TopBar";
import RoundProgressBar from "./RoundProgressBar";
import PlayerDock from "./PlayerDock";
import SetupView from "./phases/SetupView";
import EndedView from "./phases/EndedView";
import ManageView from "./phases/ManageView";
import TradeView from "./phases/TradeView";
import PositionView from "./phases/PositionView";
import DeclareView from "./phases/DeclareView";
import InfoView from "./phases/InfoView";
import SettleView from "./phases/SettleView";
import type { PhaseViewProps } from "./phases/phaseCommon";

// 페이즈 라우터: 서버가 내려준 phase 에 맞는 뷰만 그린다.
// 상단 TopBar (나의 정보) + RoundProgressBar (회차/이벤트) 상시 노출.
// 카운트다운은 메인 화면 상단에 sticky. 하단 PlayerDock (플레이어 6칸 + 이모트) 상시 고정.
export default function GameView({
  send,
}: {
  send: (message: ClientMessage) => void;
}) {
  const state = useGameStore((s) => s.state);
  const selfId = useGameStore((s) => s.selfId);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  if (!state) return null;

  const self = state.players.find((p) => p.id === selfId);

  if (
    !self &&
    state.phase !== "LOBBY" &&
    state.phase !== "SETUP" &&
    state.phase !== "ENDED"
  ) {
    return (
      <main className="flex flex-col gap-4 pt-12">
        <div className="rounded-card border-2 border-danger bg-danger/10 p-4">
          <p className="font-medium text-danger">관전 모드</p>
          <p className="text-sm">
            이 게임이 이미 진행 중이라 새로 참여할 수 없어요. 다음 판에 합류해주세요.
          </p>
        </div>
        <PlayerDock state={state} selfId={selfId} send={send} />
      </main>
    );
  }

  const connected = state.players.filter((p) => p.connected);
  const readyCount = connected.filter((p) => p.ready).length;
  const myCompany = selfId ? state.companies[selfId] : undefined;
  const isTrade = state.phase === "TRADE";
  const isManage = state.phase === "MANAGE";
  const isInfo = state.phase === "INFO";
  const isSettle = state.phase === "SETTLE";
  // INFO 도 이제 타이머 있음 (60초).
  const hasTimer = (isTrade || isManage || isInfo) && state.phaseDeadline;
  const secondsLeft = hasTimer
    ? Math.max(0, Math.ceil((state.phaseDeadline! - now) / 1000))
    : null;

  const commonProps: PhaseViewProps = {
    state,
    self,
    selfId,
    send,
    myCompany,
    connected,
    readyCount,
    now,
  };

  return (
    <main className="flex flex-col gap-3 pt-3">
      <TopBar state={state} self={self} myCompany={myCompany} />
      <RoundProgressBar state={state} />

      {/* 메인 화면 시작 — 카운트다운을 상단 sticky 로 표시 */}
      <section className="flex flex-col gap-3">
        {secondsLeft !== null && (
          <div className="sticky top-0 z-20 -mx-1 px-1 py-1 bg-paper/95 backdrop-blur">
            <div className="flex items-center justify-end">
              <span
                className={`rounded-element border-2 border-cardEdge px-3 py-0.5 text-base font-medium tabular-nums ${
                  secondsLeft <= 5
                    ? "bg-danger text-paper animate-pulse"
                    : secondsLeft <= 15
                      ? "bg-warning/20 text-warning"
                      : "bg-accentSoft text-warning"
                }`}
              >
                ⏱ {secondsLeft}s
              </span>
            </div>
          </div>
        )}

        {state.phase === "SETUP" ? (
          <SetupView {...commonProps} />
        ) : state.phase === "ENDED" ? (
          <EndedView {...commonProps} />
        ) : state.phase === "MANAGE" ? (
          <ManageView {...commonProps} />
        ) : state.phase === "TRADE" ? (
          <TradeView {...commonProps} />
        ) : state.phase === "POSITION" ? (
          <PositionView {...commonProps} />
        ) : state.phase === "DECLARE" ? (
          <DeclareView {...commonProps} />
        ) : (
          <section className="flex flex-col gap-3">
            {isInfo && <InfoView {...commonProps} />}
            {isSettle && <SettleView {...commonProps} />}
            <p className="text-sm text-neutral">
              준비 완료 {readyCount} / {connected.length}
            </p>
            <button
              disabled={self?.ready}
              onClick={() => send({ type: "ready" })}
              className="rounded-element bg-success px-4 py-3 text-paper font-medium disabled:opacity-40"
            >
              {self?.ready
                ? "준비됨 · 다른 사람 대기 중"
                : "준비 완료"}
            </button>
            <p className="text-xs text-neutral">
              전원이 준비하면 타이머 없이 바로 다음 페이즈로 넘어갑니다.
            </p>
          </section>
        )}
      </section>

      {/* 하단 플레이어 Dock (fixed) — 접기 지원, 이모트 포함 */}
      <PlayerDock state={state} selfId={selfId} send={send} />
    </main>
  );
}
