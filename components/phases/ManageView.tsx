"use client";

import { BALANCE } from "@/game/balance";
import { SECTORS, SECTOR_LABELS } from "@/game/types";
import { clampTrust } from "@/game/helpers";
import SectorIcon from "../SectorIcon";
import { fmt, type PhaseViewProps } from "./phaseCommon";

// MANAGE 페이즈: 은행/연구/기술/피벗/국가 매각/NPC 제안 카드 + 투자자 부활 IPO.
export default function ManageView({
  state,
  self,
  selfId,
  send,
  myCompany,
}: PhaseViewProps) {
  return (
    <section className="flex flex-col gap-3">
      <p className="text-sm text-neutral">
        30초 안에 회사를 관리할 수 있어요. 연구, 기술 업그레이드, 사업 전환, 회사 매각.
      </p>

      {/* 🚨 마진콜 배너 */}
      {myCompany && (self?.loanMissCount ?? 0) >= 2 && (() => {
        const missLeft =
          BALANCE.bankMissForForeclosure - (self?.loanMissCount ?? 0);
        const rate = BALANCE.bankInterestByTrust[clampTrust(myCompany.trust)];
        const owed = Math.floor((self?.loanBalance ?? 0) * rate);
        const canPay = (self?.cash ?? 0) >= owed;
        return (
          <div className="rounded-card border-2 border-danger bg-danger/15 p-3 flex flex-col gap-2 animate-pulse">
            <p className="font-medium text-danger">
              🚨 마진콜 · 미납 {self?.loanMissCount}회 (다음 이자 못 갚으면 압류)
            </p>
            <p className="text-xs">
              다음 이자: <span className="tabular-nums font-medium">{fmt(owed)}</span>
              {" · "}
              현금: <span className="tabular-nums">{fmt(self?.cash ?? 0)}</span>
              {" · "}
              압류까지: {missLeft}회
            </p>
            {canPay ? (
              <p className="text-xs text-neutral">
                ✅ 이번 회차 이자는 갚을 수 있어요. 상환 유지 시 카운트 리셋.
              </p>
            ) : (
              <button
                onClick={() => {
                  const amt = Math.min(self?.loanBalance ?? 0, self?.cash ?? 0);
                  if (amt > 0) send({ type: "repayLoan", amount: amt });
                }}
                className="rounded-element bg-danger text-paper px-3 py-2 text-sm font-medium"
              >
                🏦 가능한 금액 즉시 원금 상환 ({fmt(Math.min(self?.loanBalance ?? 0, self?.cash ?? 0))})
              </button>
            )}
          </div>
        );
      })()}

      {myCompany && (
        <div className="rounded-card border-2 border-cardEdge bg-card p-3 flex flex-col gap-3">
          <div className="flex items-center gap-3">
            <SectorIcon sector={myCompany.sector} size={32} />
            <div className="flex-1">
              <p className="font-medium">{myCompany.name}</p>
              <p className="text-xs text-neutral">
                {SECTOR_LABELS[myCompany.sector]} · Lv.{myCompany.techLevel} ·
                ★{myCompany.trust}
              </p>
            </div>
            <span className="tabular-nums text-sm">{fmt(myCompany.price)}</span>
          </div>

          {/* 🏦 은행 */}
          {(() => {
            const trustIdx = clampTrust(myCompany.trust);
            const rate = BALANCE.bankInterestByTrust[trustIdx];
            const limit = BALANCE.bankLoanLimitByTrust[trustIdx];
            const balance = self?.loanBalance ?? 0;
            const missCount = self?.loanMissCount ?? 0;
            const nextInterest = Math.floor(balance * rate);
            const roomLeft = Math.max(0, limit - balance);
            const cash = self?.cash ?? 0;
            const borrowPresets = [
              Math.min(5_000_000, roomLeft),
              Math.min(10_000_000, roomLeft),
              roomLeft,
            ].filter((v, i, arr) => v > 0 && arr.indexOf(v) === i);
            const repayPresets = [
              Math.min(5_000_000, balance, cash),
              Math.min(10_000_000, balance, cash),
              Math.min(balance, cash),
            ].filter((v, i, arr) => v > 0 && arr.indexOf(v) === i);
            return (
              <details className="rounded-element border-2 border-cardEdge bg-paper px-3 py-2" open={balance > 0}>
                <summary className="cursor-pointer flex justify-between items-center">
                  <span className="flex items-center gap-2">
                    <span className="text-xl">🏦</span>
                    <span>
                      <span className="font-medium">은행</span>
                      <span className="block text-xs text-neutral">
                        이자 {(rate * 100).toFixed(0)}%/턴 · 한도 {fmt(limit)}
                      </span>
                    </span>
                  </span>
                  <span className="text-sm tabular-nums">
                    {balance > 0 ? (
                      <span className="text-danger">−{fmt(balance)}</span>
                    ) : (
                      <span className="text-neutral">대출 없음</span>
                    )}
                  </span>
                </summary>
                <div className="mt-3 flex flex-col gap-3">
                  {balance > 0 && (
                    <div className="rounded-element border border-cardEdge bg-card px-2 py-2 text-xs flex flex-wrap gap-x-3 gap-y-1">
                      <span>원금 <span className="tabular-nums font-medium">{fmt(balance)}</span></span>
                      <span>다음 이자 <span className="tabular-nums text-danger">−{fmt(nextInterest)}</span></span>
                      <span>
                        미납 <span className={missCount === 0 ? "text-success" : missCount >= 2 ? "text-danger font-medium" : "text-warning"}>{missCount}/{BALANCE.bankMissForForeclosure}</span>
                      </span>
                    </div>
                  )}

                  {roomLeft > 0 && (
                    <div className="flex flex-col gap-1">
                      <p className="text-xs text-neutral">💰 대출 받기 (남은 한도 {fmt(roomLeft)})</p>
                      <div className="flex gap-1 flex-wrap">
                        {borrowPresets.map((amt) => (
                          <button
                            key={`b-${amt}`}
                            onClick={() => send({ type: "takeLoan", amount: amt })}
                            className="rounded-element border-2 border-cardEdge bg-card px-2 py-1 text-xs"
                          >
                            +{fmt(amt)}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {balance > 0 && repayPresets.length > 0 && (
                    <div className="flex flex-col gap-1">
                      <p className="text-xs text-neutral">🏦 상환 (현금 {fmt(cash)})</p>
                      <div className="flex gap-1 flex-wrap">
                        {repayPresets.map((amt) => (
                          <button
                            key={`r-${amt}`}
                            onClick={() => send({ type: "repayLoan", amount: amt })}
                            className="rounded-element border-2 border-cardEdge bg-card px-2 py-1 text-xs"
                          >
                            −{fmt(amt)}
                          </button>
                        ))}
                      </div>
                      <p className="text-[10px] text-neutral">
                        잔액 0 이 되면 미납 카운트가 리셋됩니다.
                      </p>
                    </div>
                  )}

                  {balance === 0 && roomLeft === 0 && (
                    <p className="text-xs text-neutral">신뢰도가 낮아 한도가 없어요.</p>
                  )}
                </div>
              </details>
            );
          })()}

          {/* 연구 */}
          {(() => {
            const done = myCompany.researchDoneThisManage;
            const outcome = myCompany.lastResearchOutcome;
            const outcomeLabel =
              outcome === "jackpot"
                ? "🎉 대성공"
                : outcome === "success"
                  ? "🔬 성공"
                  : outcome === "fail"
                    ? "💧 실패"
                    : null;
            return (
              <div className="rounded-element border-2 border-cardEdge bg-paper p-2 flex flex-col gap-2">
                <div className="flex justify-between items-baseline">
                  <span className="text-sm font-medium">🔬 연구 투자</span>
                  {done && (
                    <span className={`text-xs ${outcome === "jackpot" || outcome === "success" ? "text-success" : "text-neutral"}`}>
                      {outcomeLabel}
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-3 gap-1">
                  {BALANCE.researchTiers.map((tier, idx) => {
                    const affordable = (self?.cash ?? 0) >= tier.cost;
                    return (
                      <button
                        key={idx}
                        disabled={done || !affordable}
                        onClick={() => send({ type: "research", tier: idx as 0 | 1 | 2 })}
                        className="rounded-element border-2 border-cardEdge bg-card px-2 py-2 text-xs flex flex-col items-center disabled:opacity-40"
                      >
                        <span className="text-sm font-medium">{fmt(tier.cost)}</span>
                        <span className="text-neutral text-[10px] mt-1">
                          🎉 {(tier.jackpot * 100).toFixed(0)}% · 🔬{" "}
                          {(tier.success * 100).toFixed(0)}%
                        </span>
                        <span className="text-neutral text-[10px]">
                          💧 {((1 - tier.jackpot - tier.success) * 100).toFixed(0)}%
                        </span>
                      </button>
                    );
                  })}
                </div>
                <p className="text-[10px] text-neutral">
                  대성공 +{(BALANCE.researchJackpotRange[0] * 100).toFixed(0)}~
                  {(BALANCE.researchJackpotRange[1] * 100).toFixed(0)}% · 성공 +
                  {(BALANCE.researchSuccessRange[0] * 100).toFixed(0)}~
                  {(BALANCE.researchSuccessRange[1] * 100).toFixed(0)}% · 실패 손실 없음
                </p>
              </div>
            );
          })()}

          {/* 기술 업그레이드 */}
          {(() => {
            const cost = BALANCE.techUpgradeCost(myCompany.techLevel);
            const maxed = myCompany.techLevel >= 5;
            const affordable = (self?.cash ?? 0) >= cost;
            return (
              <button
                disabled={maxed || !affordable}
                onClick={() => send({ type: "techUpgrade" })}
                className="rounded-element border-2 border-cardEdge bg-card px-3 py-2 text-left flex justify-between items-center disabled:opacity-40"
              >
                <span>
                  🔧 기술 업그레이드 Lv.{myCompany.techLevel} →{" "}
                  {Math.min(5, myCompany.techLevel + 1)}
                  <span className="block text-xs text-neutral">
                    정산 시 +{((myCompany.techLevel + 1) * BALANCE.techGrowthPerLevel * 100).toFixed(1)}%/회차
                  </span>
                </span>
                <span className="text-sm text-danger tabular-nums">
                  {maxed ? "최대" : `−${fmt(cost)}`}
                </span>
              </button>
            );
          })()}

          {/* 피벗 */}
          {(() => {
            const marketCap = myCompany.price * myCompany.sharesOutstanding;
            const cost = Math.floor(marketCap * BALANCE.pivotCostRate);
            const affordable = (self?.cash ?? 0) >= cost;
            return (
              <details className="rounded-element border-2 border-cardEdge bg-card px-3 py-2">
                <summary className="cursor-pointer flex justify-between items-center">
                  <span>
                    🔀 사업 전환 (피벗)
                    <span className="block text-xs text-neutral">
                      새 섹터 + 신뢰도 3 리셋
                    </span>
                  </span>
                  <span className="text-sm text-danger tabular-nums">
                    −{fmt(cost)}
                  </span>
                </summary>
                <div className="grid grid-cols-2 gap-2 mt-3">
                  {SECTORS.filter((s) => s !== myCompany.sector).map((s) => (
                    <button
                      key={s}
                      disabled={!affordable}
                      onClick={() => send({ type: "pivot", newSector: s })}
                      className="rounded-element border-2 border-cardEdge bg-paper px-2 py-2 text-sm flex items-center gap-1 disabled:opacity-40"
                    >
                      <SectorIcon sector={s} size={20} />
                      <span>{SECTOR_LABELS[s]}</span>
                    </button>
                  ))}
                </div>
              </details>
            );
          })()}

          {/* 국가 매각 */}
          {(() => {
            const marketCap = myCompany.price * myCompany.sharesOutstanding;
            const payout = Math.floor(marketCap * BALANCE.nationBuyoutRate);
            return (
              <button
                onClick={() => {
                  if (
                    confirm(
                      `국가 매각: ${fmt(payout)} (시장가 50%) 을 즉시 받고 회사가 상장폐지됩니다. 진행할까요?`
                    )
                  ) {
                    send({ type: "sellToNation" });
                  }
                }}
                className="nation-btn relative rounded-element border-2 border-cardEdge bg-card px-3 py-2 text-left flex justify-between items-center overflow-hidden"
              >
                <span className="flex items-center gap-2">
                  <span className="text-2xl">🏛️</span>
                  <span>
                    <span className="font-medium">국가 매각</span>
                    <span className="block text-xs text-neutral">
                      시장가 {(BALANCE.nationBuyoutRate * 100).toFixed(0)}% · 즉시 확정 · 투자자 전환
                    </span>
                  </span>
                </span>
                <span className="text-sm text-success tabular-nums">
                  +{fmt(payout)}
                </span>
                <style jsx>{`
                  .nation-btn::after {
                    content: "OFFICIAL";
                    position: absolute;
                    top: 2px;
                    right: 6px;
                    font-size: 8px;
                    letter-spacing: 1px;
                    color: rgba(0, 0, 0, 0.3);
                    border: 1px solid rgba(0, 0, 0, 0.3);
                    padding: 0 3px;
                    border-radius: 2px;
                    transform: rotate(4deg);
                  }
                `}</style>
              </button>
            );
          })()}

          {/* NPC 인수 제안 */}
          {(() => {
            const myOffers = state.exitOffers.filter(
              (o) => o.companyOwnerId === selfId
            );
            if (myOffers.length === 0) {
              return (
                <div className="rounded-element border-2 border-cardEdge bg-paper px-3 py-2 text-xs text-neutral">
                  💌 이번 회차에는 인수 제안이 도착하지 않았어요.
                </div>
              );
            }
            const buyerTone = (
              k: string
            ): { border: string; accent: string; ribbon: string } => {
              switch (k) {
                case "HAWK":
                  return { border: "border-danger", accent: "text-danger", ribbon: "🐺 매파" };
                case "HEDGE":
                  return { border: "border-danger", accent: "text-danger", ribbon: "🩸 적대" };
                case "CHAEBOL":
                  return { border: "border-warning", accent: "text-warning", ribbon: "🏢 재벌" };
                case "VC":
                  return { border: "border-success", accent: "text-success", ribbon: "🌟 러브콜" };
                case "MYSTERY":
                  return { border: "border-warning", accent: "text-warning", ribbon: "🕵️ 비밀" };
                default:
                  return { border: "border-cardEdge", accent: "text-neutral", ribbon: "제안" };
              }
            };
            return (
              <div className="flex flex-col gap-2">
                <p className="text-sm font-medium">
                  💌 인수 제안 · {myOffers.length}건 도착
                </p>
                {myOffers.map((o, i) => {
                  const t = buyerTone(o.buyerKey);
                  return (
                    <button
                      key={o.id}
                      onClick={() => {
                        if (
                          confirm(
                            `${o.buyerLabel} 의 제안 (${fmt(o.price)}, 시장가 ${(o.priceRate * 100).toFixed(0)}%) 을 수락하시겠어요? 회사가 상장폐지됩니다.`
                          )
                        ) {
                          send({ type: "acceptExitOffer", offerId: o.id });
                        }
                      }}
                      style={{ animationDelay: `${i * 90}ms` }}
                      className={`offer-card relative rounded-element border-2 ${t.border} bg-card px-3 py-2 text-left flex justify-between items-center overflow-hidden`}
                    >
                      <span
                        className={`absolute top-0 right-0 text-[10px] px-1.5 py-0.5 rounded-bl-md bg-paper border-l border-b ${t.border} ${t.accent}`}
                      >
                        {t.ribbon}
                      </span>
                      <span className="flex items-center gap-2">
                        <span className="text-2xl offer-icon">{o.buyerIcon}</span>
                        <span>
                          <span className={`font-medium ${t.accent}`}>
                            {o.buyerLabel}
                          </span>
                          <span className="block text-xs text-neutral">
                            시장가 {(o.priceRate * 100).toFixed(0)}% 제시
                          </span>
                        </span>
                      </span>
                      <span className="text-sm text-success tabular-nums pr-8">
                        +{fmt(o.price)}
                      </span>
                    </button>
                  );
                })}
                <style jsx>{`
                  .offer-card {
                    animation: offer-slide-in 420ms cubic-bezier(0.2, 1.2, 0.4, 1) both;
                  }
                  .offer-card:hover .offer-icon {
                    animation: offer-icon-wiggle 500ms ease-in-out;
                  }
                  @keyframes offer-slide-in {
                    from {
                      transform: translateX(24px) scale(0.96);
                      opacity: 0;
                    }
                    to {
                      transform: translateX(0) scale(1);
                      opacity: 1;
                    }
                  }
                  @keyframes offer-icon-wiggle {
                    0%,
                    100% {
                      transform: rotate(0);
                    }
                    25% {
                      transform: rotate(-12deg);
                    }
                    75% {
                      transform: rotate(12deg);
                    }
                  }
                `}</style>
              </div>
            );
          })()}
        </div>
      )}

      {/* 투자자 부활 IPO */}
      {!myCompany && self?.isInvestor && (() => {
        const roundsLeft = state.maxRounds - state.round;
        const canRebirth =
          roundsLeft >= BALANCE.rebirthMinRoundsLeft &&
          (self?.cash ?? 0) >= BALANCE.rebirthCost;
        const reason =
          roundsLeft < BALANCE.rebirthMinRoundsLeft
            ? `남은 회차 ${roundsLeft} · ${BALANCE.rebirthMinRoundsLeft}회차 이상 남아야 창업 가능`
            : (self?.cash ?? 0) < BALANCE.rebirthCost
              ? `현금 부족 (필요 ${fmt(BALANCE.rebirthCost)})`
              : `새 회사 창업 · 랜덤 섹터`;
        return (
          <div className="rounded-card border-2 border-cardEdge bg-card p-3 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">💼</span>
              <div className="flex-1">
                <p className="font-medium">투자자 모드</p>
                <p className="text-xs text-neutral">
                  회사가 없어요. 매매·정보 구매로 자산을 굴리거나 새로 창업할 수 있어요.
                </p>
              </div>
            </div>
            <button
              disabled={!canRebirth}
              onClick={() => send({ type: "foundNewCompany" })}
              className={`rebirth-btn rounded-element border-2 border-warning bg-paper px-3 py-2 text-left flex justify-between items-center disabled:opacity-40 disabled:border-cardEdge ${
                canRebirth ? "rebirth-glow" : ""
              }`}
            >
              <span className="flex items-center gap-2">
                <span className="text-2xl rebirth-rocket">🚀</span>
                <span>
                  <span className="font-medium">부활 IPO (새 회사 창업)</span>
                  <span className="block text-xs text-neutral">{reason}</span>
                </span>
              </span>
              <span className="text-sm text-danger tabular-nums">
                −{fmt(BALANCE.rebirthCost)}
              </span>
              <style jsx>{`
                .rebirth-glow {
                  animation: rebirth-glow 2s ease-in-out infinite;
                }
                .rebirth-glow .rebirth-rocket {
                  display: inline-block;
                  animation: rebirth-hover 2s ease-in-out infinite;
                }
                @keyframes rebirth-glow {
                  0%,
                  100% {
                    box-shadow: 0 0 0 0 rgba(240, 180, 40, 0);
                  }
                  50% {
                    box-shadow: 0 0 12px 2px rgba(240, 180, 40, 0.4);
                  }
                }
                @keyframes rebirth-hover {
                  0%,
                  100% {
                    transform: translateY(0);
                  }
                  50% {
                    transform: translateY(-3px);
                  }
                }
              `}</style>
            </button>
          </div>
        );
      })()}

      <p className="text-xs text-neutral">
        현금 {fmt(self?.cash ?? 0)} · 시간이 끝나면 자동으로 다음 회차
      </p>
    </section>
  );
}
