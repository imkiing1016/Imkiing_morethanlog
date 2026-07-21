"use client";

import { SECTOR_LABELS } from "@/game/types";
import SectorIcon from "../SectorIcon";
import Sparkline from "../Sparkline";
import { fmt, type PhaseViewProps } from "./phaseCommon";

// SETTLE 페이즈: 회사 분위기 · 이번 회차 뉴스 · 연구 성과 · 회사별 상세.
// 총자산은 은닉. 매매 순손익도 노출 안 함 (심리전 유지).
export default function SettleView({ state, self, selfId }: PhaseViewProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* 🌡️ 최종 종가 + 무드 */}
      <div className="rounded-card border-2 border-info bg-info/10 p-3">
        <p className="text-xs text-neutral">🔔 회차 {state.round} 장 마감</p>
        <p className="text-lg font-medium">🌡️ 최종 종가 · 회사 분위기</p>
        <ul className="mt-2 flex flex-col gap-1">
          {state.players
            .filter((p) => state.companies[p.id])
            .map((p) => {
              const co = state.companies[p.id];
              const prev = co.prevSettlePrice ?? co.price;
              const pct = prev > 0 ? ((co.price - prev) / prev) * 100 : 0;
              const mood =
                pct > 15
                  ? "🔥"
                  : pct > 5
                    ? "📈"
                    : pct >= -5
                      ? "➡️"
                      : pct >= -15
                        ? "📉"
                        : "💀";
              const moodLabel =
                pct > 15
                  ? "폭등"
                  : pct > 5
                    ? "상승"
                    : pct >= -5
                      ? "보합"
                      : pct >= -15
                        ? "하락"
                        : "폭락";
              return (
                <li
                  key={p.id}
                  className="flex justify-between text-sm items-center"
                >
                  <span className="flex items-center gap-1">
                    <span className="text-base">{mood}</span>
                    <span className="mascot">
                      {<SectorIcon sector={co.sector} size={20} />}
                    </span>
                    <span className="truncate">{co.name}</span>
                    <span className="text-[10px] text-neutral">{moodLabel}</span>
                  </span>
                  <span className="tabular-nums whitespace-nowrap">
                    {fmt(co.price)}{" "}
                    <span
                      className={
                        pct > 0
                          ? "text-success"
                          : pct < 0
                            ? "text-danger"
                            : "text-neutral"
                      }
                    >
                      {pct > 0 ? "▲" : pct < 0 ? "▼" : "─"}
                      {Math.abs(pct).toFixed(1)}%
                    </span>
                  </span>
                </li>
              );
            })}
        </ul>
      </div>

      {/* 📰 이번 회차 뉴스 */}
      {(() => {
        const roundNews = state.newsEvents.filter((n) => n.round === state.round);
        if (roundNews.length === 0) return null;
        return (
          <div className="rounded-card border-2 border-cardEdge bg-card p-3 flex flex-col gap-2">
            <p className="text-sm font-medium">
              📰 이번 회차 뉴스 · {roundNews.length}건
            </p>
            <ul className="flex flex-col gap-1.5">
              {roundNews.map((n) => (
                <li
                  key={n.id}
                  className={`text-xs rounded-element px-2 py-1.5 border ${
                    n.tone === "good"
                      ? "border-success/40 bg-success/10"
                      : n.tone === "bad"
                        ? "border-danger/40 bg-danger/10"
                        : "border-cardEdge bg-paper"
                  }`}
                >
                  <span className="text-sm mr-1">{n.emoji}</span>
                  <span className="font-medium">{n.headline}</span>
                  {n.detail && (
                    <span className="block text-neutral mt-0.5">{n.detail}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        );
      })()}

      {/* 🔬 연구 성과 */}
      {(() => {
        const researched = state.players
          .map((p) => {
            const co = state.companies[p.id];
            if (!co || !co.lastResearchOutcome) return null;
            return { player: p, co };
          })
          .filter(
            (
              x
            ): x is {
              player: NonNullable<typeof x>["player"];
              co: NonNullable<typeof x>["co"];
            } => !!x
          );
        if (researched.length === 0) return null;
        return (
          <div className="rounded-card border-2 border-cardEdge bg-card p-3 flex flex-col gap-2">
            <p className="text-sm font-medium">🔬 연구 · 기술 성과</p>
            <ul className="flex flex-col gap-1">
              {researched.map(({ player, co }) => {
                const outcome = co.lastResearchOutcome!;
                const label =
                  outcome === "jackpot"
                    ? { emoji: "🎉", txt: "대성공", cls: "text-success" }
                    : outcome === "success"
                      ? { emoji: "🔬", txt: "성공", cls: "text-success" }
                      : { emoji: "💧", txt: "실패", cls: "text-neutral" };
                return (
                  <li
                    key={player.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="flex items-center gap-1.5">
                      <span className="mascot">
                        {<SectorIcon sector={co.sector} size={20} />}
                      </span>
                      <span className="truncate">
                        {co.name}
                        <span className="ml-1 text-[10px] text-neutral">
                          Lv.{co.techLevel}
                        </span>
                      </span>
                    </span>
                    <span className={`text-sm font-medium ${label.cls}`}>
                      {label.emoji} {label.txt}
                    </span>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })()}

      {/* 회차 상세 (회사별 카드) */}
      <p className="text-sm text-neutral">📊 회차 {state.round} 상세</p>
      {state.players
        .filter((other) => state.companies[other.id])
        .map((other) => {
          const co = state.companies[other.id];
          const prev = co.prevSettlePrice ?? co.price;
          const prevTrust = co.prevSettleTrust ?? co.trust;
          const delta = co.price - prev;
          const pct = prev > 0 ? (delta / prev) * 100 : 0;
          const trustDelta = co.trust - prevTrust;
          const isMine = other.id === selfId;
          return (
            <div
              key={other.id}
              className={`rounded-card border-2 p-3 flex flex-col gap-2 ${
                isMine ? "border-warning bg-accentSoft" : "border-cardEdge bg-card"
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="mascot">
                  {<SectorIcon sector={co.sector} size={24} />}
                </span>
                <div className="flex-1">
                  <p className="font-medium">
                    {co.name}
                    {isMine && (
                      <span className="ml-2 text-xs text-warning">내 회사</span>
                    )}
                  </p>
                  <p className="text-xs text-neutral">
                    {SECTOR_LABELS[co.sector]} · {other.declaration ?? "—"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="tabular-nums">{fmt(co.price)}</p>
                  <p
                    className={`text-lg font-medium tabular-nums ${
                      pct > 0
                        ? "text-success"
                        : pct < 0
                          ? "text-danger"
                          : "text-neutral"
                    }`}
                  >
                    {pct > 0 ? "▲" : pct < 0 ? "▼" : "─"}{" "}
                    {Math.abs(pct).toFixed(1)}%
                  </p>
                </div>
              </div>
              <Sparkline points={co.pricePoints ?? []} width={330} height={44} />
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="rounded-element bg-paper border border-cardEdge px-2 py-1">
                  {fmt(prev)} → {fmt(co.price)}
                </span>
                {trustDelta !== 0 && (
                  <span
                    className={`rounded-element px-2 py-1 border ${
                      trustDelta > 0
                        ? "bg-success/10 border-success/30 text-success"
                        : "bg-danger/10 border-danger/30 text-danger"
                    }`}
                  >
                    ★ {trustDelta > 0 ? "+" : ""}
                    {trustDelta} (현 {co.trust})
                  </span>
                )}
                {co.auditedThisRound && (
                  <span className="rounded-element bg-danger/10 border border-danger/30 text-danger px-2 py-1">
                    🚨 세무 조사
                  </span>
                )}
              </div>
            </div>
          );
        })}
      {self && (
        <div className="rounded-card border-2 border-info bg-info/5 p-3">
          <p className="text-xs text-neutral">🔒 내 자산 (본인만 표시)</p>
          <p className="text-2xl font-medium tabular-nums">
            {fmt(
              self.cash +
                Object.entries(self.holdings ?? {}).reduce(
                  (sum, [cid, n]) =>
                    sum + n * (state.companies[cid]?.price ?? 0),
                  0
                )
            )}
          </p>
          <p className="text-xs text-neutral">
            현금 {fmt(self.cash)} + 주식 평가액
          </p>
        </div>
      )}
    </div>
  );
}
