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
      {/* 1행: 회차/페이즈 + 타이머 */}
      <div className="flex items-center justify-between">
        <div className="flex items-baseline gap-2">
          {state.round >= 1 && (
            <span className="text-xs text-neutral tabular-nums">
              R {state.round}/{state.maxRounds}
            </span>
          )}
          <span className={`text-lg font-medium ${PHASE_ACCENT[state.phase]}`}>
            {PHASE_LABEL[state.phase]}
          </span>
        </div>
        {secondsLeft !== null && (
          <span className="rounded-element bg-accentSoft border-2 border-cardEdge px-3 py-0.5 text-lg font-medium text-warning tabular-nums">
            ⏱ {secondsLeft}s
          </span>
        )}
      </div>

      {/* 2행: 내 회사 이름 + 카테고리 + 현금·부채·투자자 한도 */}
      {state.round >= 1 && self && (
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
