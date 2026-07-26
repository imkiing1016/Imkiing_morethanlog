"use client";

import { BALANCE } from "@/game/balance";
import { SECTOR_LABELS } from "@/game/types";
import type { Company, GameState, PlayerState } from "@/game/types";
import SectorIcon from "./SectorIcon";
import { fmt } from "./phases/phaseCommon";

// 상단 바 — 좌측: 나의 정보 (회사/신뢰/기술/현금/총자산/대출/투자자 배지)
//         우측: 뉴스 확인 버튼 (📢 확성기)
// 화면 상단에 상시 고정. 접기 없음 (하단 Dock 만 접기 지원).
export default function TopBar({
  state,
  self,
  myCompany,
}: {
  state: GameState;
  self?: PlayerState;
  myCompany?: Company;
}) {
  if (!self) return null;
  // 총자산 = 현금 + 보유주식 평가 (본인만 볼 수 있는 값)
  const stocksValue = Object.entries(self.holdings ?? {}).reduce(
    (sum, [cid, n]) => sum + n * (state.companies[cid]?.price ?? 0),
    0
  );
  const totalAsset = self.cash + stocksValue;
  const hasLoan = (self.loanBalance ?? 0) > 0;
  const missCount = self.loanMissCount ?? 0;

  return (
    <div className="flex items-start gap-2">
      {/* 좌측: 나의 정보 카드 */}
      <div className="flex-1 min-w-0 rounded-card border-2 border-cardEdge bg-card p-2.5 flex flex-col gap-1.5">
        {/* 회사/투자자 헤더 */}
        <div className="flex items-center gap-2 min-w-0">
          {myCompany ? (
            <>
              <SectorIcon sector={myCompany.sector} size={28} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate">
                  {myCompany.name}
                </p>
                <p className="text-[10px] text-neutral truncate">
                  {SECTOR_LABELS[myCompany.sector]} · ★{myCompany.trust} · Lv
                  {myCompany.techLevel}
                </p>
              </div>
            </>
          ) : self.isInvestor ? (
            <>
              <span className="text-2xl">💼</span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">투자자</p>
                <p className="text-[10px] text-neutral truncate">
                  매매·정보로만 활동
                </p>
              </div>
            </>
          ) : (
            <p className="text-xs text-neutral">회사 없음</p>
          )}
        </div>

        {/* 자산 */}
        <div className="flex justify-between items-baseline gap-2 pt-1 border-t border-cardEdge/50">
          <div className="min-w-0">
            <p className="text-[9px] text-neutral">💰 현금</p>
            <p className="text-sm font-medium tabular-nums">{fmt(self.cash)}</p>
          </div>
          <div className="min-w-0 text-right">
            <p className="text-[9px] text-neutral">🔒 총자산 (본인만)</p>
            <p className="text-sm font-medium tabular-nums text-info">
              {fmt(totalAsset)}
            </p>
          </div>
        </div>

        {/* 대출 상태 */}
        {hasLoan && (
          <div className="flex justify-between items-center text-[10px] tabular-nums">
            <span className="text-danger">
              💸 대출 −{fmt(self.loanBalance)}
            </span>
            {missCount > 0 && (
              <span
                className={`px-1.5 py-0.5 rounded-element ${
                  missCount >= 2
                    ? "bg-danger text-paper font-medium"
                    : "text-warning"
                }`}
              >
                미납 {missCount}/{BALANCE.bankMissForForeclosure}
              </span>
            )}
          </div>
        )}

        {/* 투자자 매수 한도 */}
        {self.isInvestor && (
          <p className="text-[10px] text-neutral tabular-nums">
            💵 이번 회차 매수 {fmt(self.roundStockBuyAmount ?? 0)} /{" "}
            {fmt(BALANCE.investorBuyQuotaPerRound)}
          </p>
        )}
      </div>

      {/* 우측: NewsHistoryButton 이 이미 fixed top-3 right-3 로 그려짐 → 여기선 겹침 방지 공간만 확보 */}
      <div className="shrink-0 w-14 h-12" aria-hidden />
    </div>
  );
}
