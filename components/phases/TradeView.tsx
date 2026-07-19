"use client";

import { useState } from "react";
import { BALANCE } from "@/game/balance";
import { SECTOR_LABELS } from "@/game/types";
import HoldButton from "../HoldButton";
import SectorIcon from "../SectorIcon";
import Sparkline from "../Sparkline";
import { fmt, type PhaseViewProps } from "./phaseCommon";

// TRADE 페이즈: 전체 그리드 vs 상세 뷰 토글, 실시간 매수/매도 버튼.
// 로컬 UI 상태(뷰 모드, 포커스 종목)는 이 안에서 관리.
export default function TradeView({ state, self, selfId, send }: PhaseViewProps) {
  const [tradeView, setTradeView] = useState<"all" | "detail">("all");
  const [focusCompanyId, setFocusCompanyId] = useState<string | null>(null);

  return (
    <section className="flex flex-col gap-3">
      <p className="text-sm text-neutral">
        매수/매도하면 거래량에 따라 주가가 즉시 변동합니다. 한 번에{" "}
        {BALANCE.liveTradeStep}주씩 · 꾹 누르면 반복.
      </p>

      <div className="flex gap-1 p-1 rounded-element border-2 border-cardEdge bg-paper">
        <button
          onClick={() => setTradeView("all")}
          className={`flex-1 rounded-element px-3 py-1.5 text-sm font-medium ${
            tradeView === "all" ? "bg-ink text-paper" : "text-neutral"
          }`}
        >
          전체 종목
        </button>
        <button
          onClick={() => {
            setTradeView("detail");
            if (!focusCompanyId) {
              const first = state.players.find((p) => state.companies[p.id])?.id;
              if (first) setFocusCompanyId(first);
            }
          }}
          className={`flex-1 rounded-element px-3 py-1.5 text-sm font-medium ${
            tradeView === "detail" ? "bg-ink text-paper" : "text-neutral"
          }`}
        >
          상세 보기
        </button>
      </div>

      {tradeView === "detail" && (
        <div className="flex flex-col gap-3">
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {state.players
              .filter((p) => state.companies[p.id])
              .map((p) => {
                const co = state.companies[p.id];
                const sel = focusCompanyId === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => setFocusCompanyId(p.id)}
                    className={`shrink-0 rounded-element border-2 px-3 py-1.5 text-sm flex items-center gap-1 ${sel ? "border-ink bg-ink text-paper" : "border-cardEdge bg-card"}`}
                  >
                    <span className="mascot text-base">
                      {<SectorIcon sector={co.sector} size={24} />}
                    </span>
                    <span>{co.name}</span>
                  </button>
                );
              })}
          </div>
          {(() => {
            const cid = focusCompanyId;
            if (!cid) return null;
            const co = state.companies[cid];
            if (!co) return null;
            const owner = state.players.find((p) => p.id === cid);
            const held = self?.holdings?.[cid] ?? 0;
            const step = BALANCE.liveTradeStep;
            const pts = co.pricePoints ?? [];
            const start = pts[0] ?? co.price;
            const livePct = start > 0 ? ((co.price - start) / start) * 100 : 0;
            const isMine = cid === selfId;
            return (
              <div className="rounded-card border-2 border-cardEdge bg-card p-4 flex flex-col gap-3">
                <div className="flex items-center gap-3">
                  <span className="text-4xl">
                    {<SectorIcon sector={co.sector} size={24} />}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-lg font-medium truncate">
                      {co.name}
                      {isMine && (
                        <span className="ml-2 text-xs text-warning">내 회사</span>
                      )}
                    </p>
                    <p className="text-xs text-neutral">
                      {SECTOR_LABELS[co.sector]} · Lv{co.techLevel} · ★{co.trust} ·{" "}
                      {owner?.declaration ?? "—"}
                      {owner?.nickname && ` · ${owner.nickname}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-baseline justify-between">
                  <span className="text-3xl font-medium tabular-nums">
                    {fmt(co.price)}
                  </span>
                  <span
                    className={`text-lg tabular-nums ${livePct > 0 ? "text-success" : livePct < 0 ? "text-danger" : "text-neutral"}`}
                  >
                    {livePct > 0 ? "▲" : livePct < 0 ? "▼" : "─"}{" "}
                    {Math.abs(livePct).toFixed(2)}%
                  </span>
                </div>
                <Sparkline points={pts} width={340} height={140} />
                {owner?.declarationComment && (
                  <p className="text-sm italic text-neutral rounded-element bg-paper border border-cardEdge px-3 py-2">
                    💬 “{owner.declarationComment}”
                  </p>
                )}
                <p className="text-xs text-neutral">
                  보유 {held}주 · 평가액 {fmt(held * co.price)}
                </p>
                <div className="flex gap-2">
                  <HoldButton
                    onFire={() =>
                      send({ type: "trade", companyOwnerId: cid, shares: step })
                    }
                    className="flex-1 rounded-element bg-success text-paper px-3 py-3 font-medium"
                  >
                    매수 +{step}
                  </HoldButton>
                  <HoldButton
                    onFire={() =>
                      send({ type: "trade", companyOwnerId: cid, shares: -step })
                    }
                    className="flex-1 rounded-element bg-danger text-paper px-3 py-3 font-medium"
                  >
                    매도 −{step}
                  </HoldButton>
                </div>
                <p className="text-[10px] text-neutral text-center">
                  꾹 누르면 반복 체결
                </p>
              </div>
            );
          })()}
        </div>
      )}

      {tradeView === "all" &&
        state.players
          .filter((other) => state.companies[other.id])
          .map((other) => {
            const co = state.companies[other.id];
            const held = self?.holdings?.[other.id] ?? 0;
            const isMine = other.id === selfId;
            const step = BALANCE.liveTradeStep;
            const pts = co.pricePoints ?? [];
            const start = pts[0] ?? co.price;
            const livePct = start > 0 ? ((co.price - start) / start) * 100 : 0;
            return (
              <div
                key={other.id}
                className="rounded-card border-2 border-cardEdge bg-card p-3 flex flex-col gap-2"
              >
                <div
                  className="flex items-center gap-3 cursor-pointer"
                  onClick={() => {
                    setFocusCompanyId(other.id);
                    setTradeView("detail");
                  }}
                >
                  <SectorIcon sector={co.sector} size={32} />
                  <div className="flex-1">
                    <p className="font-medium">
                      {co.name}
                      {isMine && (
                        <span className="ml-2 text-xs text-warning">내 회사</span>
                      )}
                    </p>
                    <p className="text-xs text-neutral">
                      {SECTOR_LABELS[co.sector]} · ★{co.trust} ·{" "}
                      {other.declaration ?? "—"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="tabular-nums font-medium">{fmt(co.price)}</p>
                    <p
                      className={`text-xs tabular-nums ${
                        livePct > 0
                          ? "text-success"
                          : livePct < 0
                            ? "text-danger"
                            : "text-neutral"
                      }`}
                    >
                      {livePct > 0 ? "▲" : livePct < 0 ? "▼" : "─"}{" "}
                      {Math.abs(livePct).toFixed(1)}%
                    </p>
                  </div>
                </div>
                <Sparkline points={pts} width={330} height={42} />
                {other.declarationComment && (
                  <p className="text-xs italic text-neutral">
                    💬 “{other.declarationComment}” — {other.nickname}
                  </p>
                )}
                <p className="text-xs text-neutral">보유 {held}주</p>
                <div className="flex gap-2">
                  <HoldButton
                    onFire={() =>
                      send({
                        type: "trade",
                        companyOwnerId: other.id,
                        shares: step,
                      })
                    }
                    className="flex-1 rounded-element bg-success text-paper px-3 py-2.5 font-medium text-sm"
                  >
                    매수 +{step}
                  </HoldButton>
                  <HoldButton
                    onFire={() =>
                      send({
                        type: "trade",
                        companyOwnerId: other.id,
                        shares: -step,
                      })
                    }
                    className="flex-1 rounded-element bg-danger text-paper px-3 py-2.5 font-medium text-sm"
                  >
                    매도 −{step}
                  </HoldButton>
                </div>
                <p className="text-[10px] text-neutral text-center -mt-1">
                  꾹 누르면 반복 체결
                </p>
              </div>
            );
          })}

      <p className="text-xs text-neutral">
        현금 {fmt(self?.cash ?? 0)} · 시간이 끝나면 자동 정산
      </p>
    </section>
  );
}
