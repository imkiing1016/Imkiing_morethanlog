"use client";

import { BALANCE, infoBuyCostAt } from "@/game/balance";
import { SECTOR_LABELS } from "@/game/types";
import SectorIcon from "../SectorIcon";
import { fmt, type PhaseViewProps } from "./phaseCommon";

// INFO 페이즈: 정보 카드 캐러셀(내 회사 방향 + 투자자 인사이더 + 구매한 정보) + 정보 구매 UI.
// SETTLE 과 함께 사용되는 공통 하단 준비 버튼은 여기 안 포함 (부모에서 렌더).
export default function InfoView({ state, self, selfId, send }: PhaseViewProps) {
  if (!self) return null;

  // [내 정보, 구매한 정보들] 을 하나의 카드 리스트로 통합.
  // 투자자는 자기 privateInfo 없음 → 구매한 정보만 카드로 표시 (없으면 빈 리스트).
  const cards: Array<{
    key: string;
    ownerId: string;
    isMine: boolean;
    direction: "BULLISH" | "BEARISH";
  }> = [];
  if (self.privateInfo) {
    cards.push({
      key: `self-${selfId}`,
      ownerId: selfId ?? "",
      isMine: true,
      direction: self.privateInfo,
    });
  }
  (self.purchasedInfos ?? []).forEach((info) => {
    cards.push({
      key: `p-${info.ownerId}`,
      ownerId: info.ownerId,
      isMine: false,
      direction: info.direction,
    });
  });
  const isInvestor = !!self.isInvestor;

  return (
    <>
      <div className="flex flex-col gap-2">
        <div className="flex justify-between items-baseline">
          <p className="text-sm font-medium">📇 이번 회차 정보 카드</p>
          <p className="text-xs text-neutral">
            {cards.length}장{cards.length > 1 && " · 좌우로 넘겨보세요"}
          </p>
        </div>
        {cards.length === 0 && (
          <div className="rounded-card border-2 border-dashed border-neutral/30 p-4 text-center text-xs text-neutral">
            {isInvestor
              ? "💼 투자자 — 자기 정보 없음. 아래에서 정보 구매 가능."
              : "정보 없음"}
          </div>
        )}
        <div
          className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2"
          style={{ scrollbarWidth: "none" }}
        >
          {cards.map((card) => {
            const co = state.companies[card.ownerId];
            const isUp = card.direction === "BULLISH";
            return (
              <div
                key={card.key}
                className={`shrink-0 basis-full snap-center rounded-card border-2 p-4 flex flex-col gap-3 ${
                  isUp
                    ? "border-success bg-success/10"
                    : "border-danger bg-danger/10"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs text-neutral">
                    {card.isMine ? "🔒 내 회사 정보" : "💰 구매한 정보"}
                  </span>
                  <span className="text-xs text-neutral">
                    회차 {state.round} 정산
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-5xl">
                    {co ? <SectorIcon sector={co.sector} size={40} /> : "❓"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{co?.name ?? "—"}</p>
                    <p className="text-xs text-neutral">
                      {co ? SECTOR_LABELS[co.sector] : ""}
                    </p>
                  </div>
                </div>
                <div className="text-center py-2">
                  <p
                    className={`text-3xl font-medium ${isUp ? "text-success" : "text-danger"}`}
                  >
                    {isUp ? "호재 ▲ 상승 예고" : "악재 ▼ 하락 예고"}
                  </p>
                </div>
                <p className="text-xs text-neutral text-center">
                  강도는 비공개 · 나만 볼 수 있는 정보
                </p>
              </div>
            );
          })}
        </div>
        <div className="flex justify-center gap-1.5">
          {cards.map((c) => (
            <span
              key={c.key}
              className="w-1.5 h-1.5 rounded-full bg-neutral/40"
            />
          ))}
        </div>
      </div>

      {/* 정보 구매 */}
      <div className="rounded-card border border-neutral/20 p-3 flex flex-col gap-2">
        {(() => {
          const cost = infoBuyCostAt(state.round, state.maxRounds);
          return (
            <div className="flex justify-between items-baseline">
              <p className="text-xs text-neutral">정보 구매</p>
              <p className="text-xs text-neutral">
                {self.purchasedInfos?.length ?? 0} / {BALANCE.infoBuyMax} ·{" "}
                {fmt(cost)}/건
              </p>
            </div>
          );
        })()}
        {state.players
          .filter((other) => other.id !== selfId && state.companies[other.id])
          .map((other) => {
            const co = state.companies[other.id];
            const owned = self.purchasedInfos?.some(
              (x) => x.ownerId === other.id
            );
            const maxed =
              (self.purchasedInfos?.length ?? 0) >= BALANCE.infoBuyMax;
            const cost = infoBuyCostAt(state.round, state.maxRounds);
            const tooPoor = self.cash < cost;
            return (
              <button
                key={other.id}
                disabled={owned || maxed || tooPoor}
                onClick={() =>
                  send({ type: "buyInfo", targetOwnerId: other.id })
                }
                className="rounded-element border border-neutral/30 px-3 py-2 text-sm text-left flex justify-between items-center disabled:opacity-40"
              >
                <span className="flex items-center gap-1.5">
                  <span className="mascot text-lg">
                    {<SectorIcon sector={co.sector} size={24} />}
                  </span>
                  {co.name}
                  <span className="text-neutral">
                    ({SECTOR_LABELS[co.sector]})
                  </span>
                </span>
                <span className="text-neutral">
                  {owned
                    ? "구매됨"
                    : maxed
                      ? "한도 초과"
                      : tooPoor
                        ? "잔액 부족"
                        : "정보 구매"}
                </span>
              </button>
            );
          })}
        <p className="text-xs text-neutral">현금 {fmt(self.cash)}</p>
      </div>
    </>
  );
}
