"use client";

import { useState } from "react";
import { BALANCE } from "@/game/balance";
import { SECTOR_LABELS } from "@/game/types";
import SectorIcon from "../SectorIcon";
import { fmt, type PhaseViewProps } from "./phaseCommon";

// POSITION 페이즈: 회사별 ±수량 비공개 매수/매도 의도 제출.
export default function PositionView({
  state,
  self,
  selfId,
  send,
  connected,
  readyCount,
}: PhaseViewProps) {
  const [positionOrders, setPositionOrders] = useState<Record<string, number>>({});

  const totalCost = Object.entries(positionOrders).reduce((sum, [cid, n]) => {
    const co = state.companies[cid];
    return sum + (co ? co.price * n : 0);
  }, 0);
  const myCash = self?.cash ?? 0;
  const overCash = totalCost > myCash;

  return (
    <section className="flex flex-col gap-3">
      <p className="text-sm text-neutral">
        선언 전, 비공개로 매수/매도 의도를 깔아둡니다. 다른 사람에겐 안 보입니다.
      </p>
      {state.players
        .filter((other) => state.companies[other.id])
        .map((other) => {
          const co = state.companies[other.id];
          const qty = positionOrders[other.id] ?? 0;
          const isMine = other.id === selfId;
          const held = self?.holdings?.[other.id] ?? 0;
          const minQty = -held;
          const selfCap = Math.floor(co.sharesOutstanding * BALANCE.maxSelfOwnership);
          const maxQty = isMine ? selfCap - held : 9999;
          const step = BALANCE.liveTradeStep;
          const canDecr = qty - step >= minQty;
          const canIncr = qty + step <= maxQty;
          return (
            <div
              key={other.id}
              className="rounded-card border-2 border-cardEdge bg-card p-3 flex flex-col gap-2"
            >
              <div className="flex items-center gap-3">
                <SectorIcon sector={co.sector} size={32} />
                <div className="flex-1">
                  <p className="font-medium">
                    {co.name}
                    {isMine && (
                      <span className="ml-2 text-xs text-warning">내 회사</span>
                    )}
                  </p>
                  <p className="text-xs text-neutral">
                    {SECTOR_LABELS[co.sector]} · 보유 {held}주
                    {isMine && ` · 최대 ${selfCap}주`}
                  </p>
                </div>
                <span className="tabular-nums">{fmt(co.price)}</span>
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  disabled={!canDecr}
                  onClick={() =>
                    setPositionOrders((o) => ({
                      ...o,
                      [other.id]: Math.max(minQty, (o[other.id] ?? 0) - step),
                    }))
                  }
                  className="w-10 h-10 rounded-element border-2 border-cardEdge bg-card text-xl font-medium disabled:opacity-30"
                >
                  −
                </button>
                <span
                  className={`tabular-nums min-w-[3rem] text-center font-medium text-lg ${
                    qty > 0
                      ? "text-success"
                      : qty < 0
                        ? "text-danger"
                        : "text-neutral"
                  }`}
                >
                  {qty > 0 ? `+${qty}` : qty}
                </span>
                <button
                  disabled={!canIncr}
                  onClick={() =>
                    setPositionOrders((o) => ({
                      ...o,
                      [other.id]: Math.min(maxQty, (o[other.id] ?? 0) + step),
                    }))
                  }
                  className="w-10 h-10 rounded-element border-2 border-cardEdge bg-card text-xl font-medium disabled:opacity-30"
                >
                  +
                </button>
              </div>
            </div>
          );
        })}

      <div className="text-xs text-neutral">
        예상 투입{" "}
        <span className={`font-medium ${overCash ? "text-danger" : ""}`}>
          {fmt(totalCost)}
        </span>{" "}
        · 현금 {fmt(myCash)}
        {overCash && <span className="text-danger ml-1">· 잔액 부족</span>}
      </div>
      <button
        disabled={self?.ready || overCash}
        onClick={() => {
          const orders = Object.entries(positionOrders)
            .filter(([, n]) => n !== 0)
            .map(([companyOwnerId, shares]) => ({ companyOwnerId, shares }));
          send({ type: "submitPosition", orders });
        }}
        className="rounded-element bg-warning px-4 py-3 text-ink font-medium disabled:opacity-40"
      >
        {self?.ready
          ? "포지션 확정됨 · 대기 중"
          : Object.values(positionOrders).every((n) => !n)
            ? "포지션 없이 확정 (관망)"
            : "포지션 확정 (비공개)"}
      </button>
      <p className="text-xs text-neutral">
        확정 완료 {readyCount} / {connected.length}
      </p>
    </section>
  );
}
