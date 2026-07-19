"use client";

import type { GameState } from "@/game/types";
import SectorIcon from "./SectorIcon";
import { fmt } from "./phases/phaseCommon";

// 하단 플레이어 리스트: 페이즈별로 표시할 상태 (준비/거래 중/설립됨/연결 끊김) 조합.
interface PlayerListProps {
  state: GameState;
  selfId: string | null;
}

export default function PlayerList({ state, selfId }: PlayerListProps) {
  const isSetup = state.phase === "SETUP";
  const isDeclare = state.phase === "DECLARE";
  const isSettle = state.phase === "SETTLE";
  const isTrade = state.phase === "TRADE";

  return (
    <section className="flex flex-col gap-2">
      <p className="text-sm text-neutral">플레이어</p>
      <ul className="flex flex-col gap-1">
        {state.players.map((p) => {
          const co = state.companies[p.id];
          return (
            <li
              key={p.id}
              className="flex items-center justify-between rounded-card border-2 border-cardEdge bg-card px-3 py-2 text-sm"
            >
              <span className="font-medium flex items-center gap-2">
                {co && (
                  <span className="mascot text-xl">
                    {<SectorIcon sector={co.sector} size={24} />}
                  </span>
                )}
                <span>
                  {p.nickname}
                  {p.id === selfId && (
                    <span className="ml-1 text-xs text-warning">(나)</span>
                  )}
                  {co && (
                    <span className="block text-xs text-neutral">{co.name}</span>
                  )}
                </span>
              </span>
              <span className="text-neutral text-xs flex items-center gap-2">
                {co && !isSetup && (
                  <span className="tabular-nums">{fmt(co.price)}</span>
                )}
                {(isDeclare || isSettle || isTrade) && p.declaration && (
                  <span
                    className={
                      p.declaration === "HYPE"
                        ? "text-success"
                        : p.declaration === "WARN"
                          ? "text-danger"
                          : "text-neutral"
                    }
                  >
                    {p.declaration}
                  </span>
                )}
                <span>
                  {!p.connected
                    ? "연결 끊김"
                    : isTrade
                      ? "거래 중"
                      : p.ready
                        ? isSetup
                          ? "설립됨"
                          : "준비됨"
                        : "대기"}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
