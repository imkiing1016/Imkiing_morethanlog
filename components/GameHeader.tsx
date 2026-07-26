"use client";

import { BALANCE } from "@/game/balance";
import { SECTOR_LABELS } from "@/game/types";
import type { Phase } from "@/game/types";
import SectorIcon from "./SectorIcon";
import { fmt, type PhaseViewProps } from "./phases/phaseCommon";

// 상단 통합 바: 회차/페이즈/타이머 + 내 회사 요약 + 현금·부채·투자자 매수 한도 + 보유 주식.

const PHASE_LABEL: Record<Phase, string> = {
  LOBBY: "로비",
  SETUP: "사업 설립",
  INFO: "정보",
  POSITION: "사전 포지션",
  DECLARE: "선언",
  TRADE: "거래",
  SETTLE: "정산",
  MANAGE: "관리 페이즈",
  ENDED: "종료",
};

const PHASE_ACCENT: Record<Phase, string> = {
  LOBBY: "text-neutral",
  SETUP: "text-warning",
  INFO: "text-danger",
  POSITION: "text-danger",
  DECLARE: "text-warning",
  TRADE: "text-success",
  SETTLE: "text-info",
  MANAGE: "text-warning",
  ENDED: "text-neutral",
};

interface GameHeaderProps
  extends Pick<PhaseViewProps, "state" | "self" | "myCompany"> {
  secondsLeft: number | null;
}

export default function GameHeader({
  state,
  self,
  myCompany,
  secondsLeft,
}: GameHeaderProps) {
  return (
    <header className="rounded-card border-2 border-cardEdge bg-card p-3 flex flex-col gap-2">
      {/* 1행: 회차/페이즈 (좌) — 타이머 (중앙) — 특별 이벤트 (우) */}
      {/* MANAGE 는 회차 사이 준비 페이즈 → 다음 회차 번호를 표시하는 게 자연스럽다. */}
      <div className="grid grid-cols-3 items-center gap-2">
        {/* 좌: 회차 + 페이즈 */}
        <div className="flex items-baseline gap-2 flex-wrap min-w-0">
          {state.round >= 1 &&
            (() => {
              const displayRound =
                state.phase === "MANAGE" && state.round < state.maxRounds
                  ? state.round + 1
                  : state.round;
              return (
                <span className="text-xs text-neutral tabular-nums">
                  R {displayRound}/{state.maxRounds}
                  {state.phase === "MANAGE" &&
                    state.round < state.maxRounds && (
                      <span className="text-[9px] ml-1 text-warning">준비</span>
                    )}
                </span>
              );
            })()}
          <span className={`text-lg font-medium ${PHASE_ACCENT[state.phase]}`}>
            {PHASE_LABEL[state.phase]}
          </span>
        </div>

        {/* 중앙: 타이머 (없으면 자리만 유지) */}
        <div className="flex justify-center">
          {secondsLeft !== null ? (
            <span
              className={`rounded-element border-2 border-cardEdge px-3 py-0.5 text-lg font-medium tabular-nums ${
                secondsLeft <= 5
                  ? "bg-danger text-paper animate-pulse"
                  : secondsLeft <= 15
                    ? "bg-warning/20 text-warning"
                    : "bg-accentSoft text-warning"
              }`}
            >
              ⏱ {secondsLeft}s
            </span>
          ) : null}
        </div>

        {/* 우: 특별 이벤트 배지 */}
        <div className="flex items-center justify-end gap-1 flex-wrap">
          {state.pendingLeverage && (
            <span className="rounded-element bg-warning/20 border border-warning px-2 py-0.5 text-xs font-medium text-warning animate-pulse">
              🎢 x{state.pendingLeverage}
            </span>
          )}
          {state.pendingBigEvent && (
            <span className="rounded-element bg-danger/15 border border-danger px-2 py-0.5 text-xs font-medium text-danger animate-pulse">
              {state.pendingBigEvent.emoji}
            </span>
          )}
        </div>
      </div>

      {/* 2행: 내 회사 이름 + 카테고리 + 현금·부채·투자자 한도.
          SETUP(round=0) 에서도 표시해서 헤더가 비지 않도록 함. */}
      {(state.round >= 1 || state.phase === "SETUP") && self && (
        <div className="flex items-center justify-between border-t border-cardEdge pt-2">
          {myCompany ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="mascot text-2xl">
                {<SectorIcon sector={myCompany.sector} size={32} />}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{myCompany.name}</p>
                <p className="text-xs text-neutral">
                  {SECTOR_LABELS[myCompany.sector]} · Lv{myCompany.techLevel} · ★
                  {myCompany.trust} · {fmt(myCompany.price)}
                </p>
              </div>
            </div>
          ) : self?.isInvestor ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="mascot text-2xl">💼</span>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">투자자</p>
                <p className="text-xs text-neutral">
                  회사 매각 · 매매·정보로 활동
                </p>
              </div>
            </div>
          ) : state.phase === "SETUP" ? (
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className="mascot text-2xl">🎯</span>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {self.nickname}
                </p>
                <p className="text-xs text-neutral">
                  사업 설립 대기 · 시작 자본 세팅됨
                </p>
              </div>
            </div>
          ) : (
            <span className="text-xs text-neutral">회사 없음 (관전 모드)</span>
          )}
          <div className="text-right ml-2 flex flex-col items-end gap-0.5">
            <div>
              <p className="text-xs text-neutral">현금</p>
              <p className="text-sm font-medium tabular-nums">{fmt(self.cash)}</p>
            </div>
            {(self.loanBalance ?? 0) > 0 && (
              <p className="text-[10px] text-danger tabular-nums">
                💸 대출 −{fmt(self.loanBalance)}
                {(self.loanMissCount ?? 0) > 0 && (
                  <span className="ml-1 text-warning">
                    · 미납 {self.loanMissCount}/{BALANCE.bankMissForForeclosure}
                  </span>
                )}
              </p>
            )}
            {self.isInvestor && (
              <p className="text-[10px] text-neutral tabular-nums">
                💵 이번 회차 매수 {fmt(self.roundStockBuyAmount ?? 0)} /{" "}
                {fmt(BALANCE.investorBuyQuotaPerRound)}
              </p>
            )}
          </div>
        </div>
      )}

      {/* 3행: 내 보유 주식 */}
      {state.round >= 1 &&
        self &&
        Object.entries(self.holdings ?? {}).filter(([, n]) => n > 0).length >
          0 && (
          <div className="flex flex-wrap gap-1 border-t border-cardEdge pt-2">
            {Object.entries(self.holdings)
              .filter(([, n]) => n > 0)
              .map(([cid, n]) => {
                const co = state.companies[cid];
                if (!co) return null;
                return (
                  <span
                    key={cid}
                    className="text-xs rounded-element bg-paper border border-cardEdge px-2 py-0.5 flex items-center gap-1"
                  >
                    <span className="mascot text-sm">
                      {<SectorIcon sector={co.sector} size={24} />}
                    </span>
                    <span className="tabular-nums">
                      {n}주 · {fmt(co.price)}
                    </span>
                  </span>
                );
              })}
          </div>
        )}
    </header>
  );
}
