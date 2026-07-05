"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/store";
import { SECTORS, SECTOR_LABELS, SECTOR_MASCOTS } from "@/game/types";
import type { ClientMessage, Phase, Sector } from "@/game/types";
import { BALANCE } from "@/game/balance";
import Sparkline from "./Sparkline";
import HoldButton from "./HoldButton";

const fmt = (n: number) => n.toLocaleString("ko-KR") + "원";

// M2 임시 화면: 5페이즈 상태머신 + 사업 설립(SETUP) 검증용 최소 UI. 진짜 화면은 M4.
// 서버가 내려준 phase/round/log/phaseDeadline 을 그릴 뿐, 전환은 서버가 결정.

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

// SPEC 5장 페이즈별 액센트 색.
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

export default function GameView({
  send,
}: {
  send: (message: ClientMessage) => void;
}) {
  const state = useGameStore((s) => s.state);
  const selfId = useGameStore((s) => s.selfId);

  // 사업 설립 입력(클라 로컬).
  const [sector, setSector] = useState<Sector | null>(null);
  const [bizName, setBizName] = useState("");
  // 창업 출자(만원 단위 슬라이더 → 원 단위 값). 기본 0.
  const [seedManwon, setSeedManwon] = useState(0);
  // 포지션 페이즈: 회사별 ±수량(클라 로컬). 제출 전까지 자유 편집.
  const [positionOrders, setPositionOrders] = useState<Record<string, number>>(
    {}
  );
  // 거래 페이즈 뷰 모드: 전체 그리드 / 선택 종목 상세.
  const [tradeView, setTradeView] = useState<"all" | "detail">("all");
  const [focusCompanyId, setFocusCompanyId] = useState<string | null>(null);
  // 선언 페이즈 코멘트 (제출 전까지 로컬 유지)
  const [declareComment, setDeclareComment] = useState("");

  // 거래 페이즈 카운트다운 표시용(렌더 전용, 게임 계산 아님).
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, []);

  // POSITION 페이즈 떠나면 입력 초기화.
  useEffect(() => {
    if (state?.phase !== "POSITION") setPositionOrders({});
  }, [state?.phase]);

  // SETUP 페이즈 진입 시 로컬 폼 상태 초기화 (재시작 등에서 잔여 상태 방지).
  useEffect(() => {
    if (state?.phase === "SETUP") {
      setSector(null);
      setBizName("");
      setSeedManwon(0);
    }
    if (state?.phase !== "DECLARE") setDeclareComment("");
  }, [state?.phase]);

  if (!state) return null;

  const self = state.players.find((p) => p.id === selfId);

  // 게임 진행 중인데 내가 플레이어 목록에 없음(새로고침 등으로 id 변경) → 안내.
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
      </main>
    );
  }
  const isSetup = state.phase === "SETUP";
  const isInfo = state.phase === "INFO";
  const isPosition = state.phase === "POSITION";
  const isDeclare = state.phase === "DECLARE";
  const isSettle = state.phase === "SETTLE";
  const isTrade = state.phase === "TRADE";
  const isManage = state.phase === "MANAGE";
  const isEnded = state.phase === "ENDED";
  const connected = state.players.filter((p) => p.connected);
  const readyCount = connected.filter((p) => p.ready).length;

  const secondsLeft =
    (isTrade || isManage) && state.phaseDeadline
      ? Math.max(0, Math.ceil((state.phaseDeadline - now) / 1000))
      : null;

  const recentLog = state.log.slice(-6).reverse();
  const myCompany = selfId ? state.companies[selfId] : undefined;
  const canSubmitSetup = sector !== null && bizName.trim().length > 0;

  return (
    <main className="flex flex-col gap-6 pt-8">
      {/* 상단 통합 바: 회차 · 페이즈 · 타이머 + 내 회사 요약 + 현금 + 보유 주식 */}
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

        {/* 2행: 내 회사 이름 + 카테고리 + 현금 */}
        {state.round >= 1 && self && (
          <div className="flex items-center justify-between border-t border-cardEdge pt-2">
            {myCompany ? (
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <span className="mascot text-2xl">
                  {SECTOR_MASCOTS[myCompany.sector]}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {myCompany.name}
                  </p>
                  <p className="text-xs text-neutral">
                    {SECTOR_LABELS[myCompany.sector]} · Lv{myCompany.techLevel} ·
                    ★{myCompany.trust} · {fmt(myCompany.price)}
                  </p>
                </div>
              </div>
            ) : (
              <span className="text-xs text-neutral">회사 없음 (관전 모드)</span>
            )}
            <div className="text-right ml-2">
              <p className="text-xs text-neutral">현금</p>
              <p className="text-sm font-medium tabular-nums">
                {fmt(self.cash)}
              </p>
            </div>
          </div>
        )}

        {/* 3행: 내 보유 주식 (있을 때만) */}
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
                        {SECTOR_MASCOTS[co.sector]}
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

      {isSetup ? (
        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <p className="font-medium">내 사업 만들기</p>
            <p className="text-sm text-neutral">
              카테고리를 고르고 회사 이름을 정하세요. 시작 시총은 모두 같습니다.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            {SECTORS.map((s) => (
              <button
                key={s}
                onClick={() => setSector(s)}
                className={`rounded-card border-2 px-3 py-3 text-sm font-medium flex items-center gap-2 ${
                  sector === s
                    ? "border-warning bg-accentSoft text-ink"
                    : "border-cardEdge bg-card text-ink"
                }`}
              >
                <span className="mascot">{SECTOR_MASCOTS[s]}</span>
                {SECTOR_LABELS[s]}
              </button>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="biz" className="text-sm text-neutral">
              회사 이름
            </label>
            <input
              id="biz"
              value={bizName}
              onChange={(e) => setBizName(e.target.value)}
              placeholder="예) 토끼물산"
              maxLength={20}
              className="rounded-element border border-neutral/30 px-3 py-3"
            />
          </div>

          <div className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <label htmlFor="seed" className="text-sm text-neutral">
                창업 출자
              </label>
              <span className="text-sm tabular-nums">
                {fmt(seedManwon * 10_000)}
                <span className="text-neutral">
                  {" "}
                  / {fmt(BALANCE.seedInvestedMax)}
                </span>
              </span>
            </div>
            <input
              id="seed"
              type="range"
              min={0}
              max={BALANCE.seedInvestedMax / 10_000}
              step={10}
              value={seedManwon}
              onChange={(e) => setSeedManwon(Number(e.target.value))}
              className="accent-warning"
            />
            <p className="text-xs text-neutral">
              내 회사에 박는 자본. 매 회차 정산 시 주가에 최대 +
              {(BALANCE.seedGrowthMax * 100).toFixed(1)}% 추가 성장 보너스(출자
              비율만큼).
            </p>
          </div>

          <button
            disabled={!canSubmitSetup}
            onClick={() =>
              sector &&
              send({
                type: "setup",
                sector,
                name: bizName.trim(),
                seedInvested: seedManwon * 10_000,
              })
            }
            className="rounded-element bg-warning px-4 py-3 font-medium text-ink disabled:opacity-40"
          >
            {self?.ready ? "사업 수정" : "사업 설립"}
          </button>

          {myCompany && (
            <p className="text-sm text-success">
              설립됨 · {myCompany.name} ({SECTOR_LABELS[myCompany.sector]}) — 다른
              사람 대기 중
            </p>
          )}
          <p className="text-xs text-neutral">
            설립 완료 {readyCount} / {connected.length}
          </p>
        </section>
      ) : isEnded ? (
        <section className="flex flex-col gap-4">
          {(() => {
            const rankings = state.finalRankings ?? [];
            const winner = rankings[0];
            const podium = rankings.slice(0, 3);
            const medals = ["🥇", "🥈", "🥉"];
            const isHost = selfId === state.hostId;
            return (
              <>
                <div className="rounded-card border-2 border-warning bg-accentSoft p-4 text-center">
                  <p className="text-xs text-neutral">🏆 최종 승자</p>
                  <p className="text-3xl font-medium text-warning">
                    {winner?.nickname ?? "—"}
                  </p>
                  <p className="text-lg tabular-nums font-medium">
                    총자산 {fmt(winner?.totalAssets ?? 0)}
                  </p>
                </div>

                {podium.length > 1 && (
                  <div className="grid grid-cols-3 gap-2 items-end">
                    {[1, 0, 2].map((idx) => {
                      const p = podium[idx];
                      if (!p) return <div key={idx} />;
                      const heights = { 0: "h-24", 1: "h-16", 2: "h-12" };
                      return (
                        <div key={p.playerId} className="flex flex-col items-center gap-1">
                          <div className="text-2xl">{medals[idx]}</div>
                          <p className="text-sm font-medium text-center">
                            {p.nickname}
                          </p>
                          <p className="text-xs text-neutral tabular-nums">
                            {fmt(p.totalAssets)}
                          </p>
                          <div
                            className={`w-full rounded-t-element bg-cardEdge ${heights[idx as 0 | 1 | 2]}`}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                <p className="text-sm text-neutral">📊 최종 순위</p>
                <ul className="flex flex-col gap-2">
                  {rankings.map((r, i) => {
                    const p = state.players.find((x) => x.id === r.playerId);
                    const co = state.companies[r.playerId];
                    const isMe = r.playerId === selfId;
                    return (
                      <li
                        key={r.playerId}
                        className={`rounded-card border-2 p-3 ${isMe ? "border-warning bg-accentSoft" : "border-cardEdge bg-card"}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium flex items-center gap-2">
                            <span className="text-lg">{i + 1}위</span>
                            {p?.isBot && "🤖 "}
                            <span>{r.nickname}</span>
                            {isMe && (
                              <span className="text-xs text-warning">(나)</span>
                            )}
                            {co && (
                              <span className="mascot">
                                {SECTOR_MASCOTS[co.sector]}
                              </span>
                            )}
                          </span>
                          <span className="text-lg font-medium tabular-nums">
                            {fmt(r.totalAssets)}
                          </span>
                        </div>
                        <div className="text-xs text-neutral flex gap-2 flex-wrap mt-1">
                          <span>현금 {fmt(r.cash)}</span>
                          <span>· 보유주식 {fmt(r.stocksValue)}</span>
                          {r.ownCompanyValue > 0 && (
                            <span>· 내 회사 {fmt(r.ownCompanyValue)}</span>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {isHost ? (
                  <button
                    onClick={() => send({ type: "rematch" })}
                    className="rounded-element bg-success px-4 py-3 text-paper font-medium"
                  >
                    🔄 리매치 (같은 인원으로 다시)
                  </button>
                ) : (
                  <p className="text-sm text-neutral">
                    호스트가 리매치를 시작할 수 있어요.
                  </p>
                )}
              </>
            );
          })()}
        </section>
      ) : isManage ? (
        <section className="flex flex-col gap-3">
          <p className="text-sm text-neutral">
            30초 안에 회사를 관리할 수 있어요. 연구, 기술 업그레이드, 사업 전환, 회사 매각.
          </p>

          {myCompany && (
            <div className="rounded-card border-2 border-cardEdge bg-card p-3 flex flex-col gap-3">
              <div className="flex items-center gap-3">
                <span className="mascot">{SECTOR_MASCOTS[myCompany.sector]}</span>
                <div className="flex-1">
                  <p className="font-medium">{myCompany.name}</p>
                  <p className="text-xs text-neutral">
                    {SECTOR_LABELS[myCompany.sector]} · Lv.{myCompany.techLevel} ·
                    ★{myCompany.trust}
                  </p>
                </div>
                <span className="tabular-nums text-sm">{fmt(myCompany.price)}</span>
              </div>

              {/* 연구 (SPEC 3.6.5): 3단계 tier — 대성공 / 성공 / 실패 */}
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
                        <span
                          className={`text-xs ${outcome === "jackpot" || outcome === "success" ? "text-success" : "text-neutral"}`}
                        >
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
                            onClick={() =>
                              send({
                                type: "research",
                                tier: idx as 0 | 1 | 2,
                              })
                            }
                            className="rounded-element border-2 border-cardEdge bg-card px-2 py-2 text-xs flex flex-col items-center disabled:opacity-40"
                          >
                            <span className="text-sm font-medium">
                              {fmt(tier.cost)}
                            </span>
                            <span className="text-neutral text-[10px] mt-1">
                              🎉 {(tier.jackpot * 100).toFixed(0)}% · 🔬{" "}
                              {(tier.success * 100).toFixed(0)}%
                            </span>
                            <span className="text-neutral text-[10px]">
                              💧{" "}
                              {((1 - tier.jackpot - tier.success) * 100).toFixed(
                                0
                              )}
                              %
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[10px] text-neutral">
                      대성공 +
                      {(BALANCE.researchJackpotRange[0] * 100).toFixed(0)}~
                      {(BALANCE.researchJackpotRange[1] * 100).toFixed(0)}%
                      · 성공 +
                      {(BALANCE.researchSuccessRange[0] * 100).toFixed(0)}~
                      {(BALANCE.researchSuccessRange[1] * 100).toFixed(0)}%
                      · 실패 손실 없음
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
                          <span className="mascot text-lg">{SECTOR_MASCOTS[s]}</span>
                          <span>{SECTOR_LABELS[s]}</span>
                        </button>
                      ))}
                    </div>
                  </details>
                );
              })()}

              {/* 매각 */}
              {(() => {
                const marketCap = myCompany.price * myCompany.sharesOutstanding;
                const minBid = Math.floor(
                  marketCap * BALANCE.exitMinPriceRate(myCompany.trust)
                );
                const listed = state.auctions.some((a) => a.companyOwnerId === selfId);
                return (
                  <button
                    disabled={listed}
                    onClick={() => send({ type: "listExit" })}
                    className={`rounded-element border-2 px-3 py-2 text-left flex justify-between items-center disabled:opacity-40 ${listed ? "border-warning bg-accentSoft" : "border-cardEdge bg-card"}`}
                  >
                    <span>
                      💼 회사 매각 (엑시트)
                      <span className="block text-xs text-neutral">
                        {listed ? "매각 중 · 낙찰 대기" : `최소가 ${fmt(minBid)}`}
                      </span>
                    </span>
                    <span className="text-sm text-neutral">
                      {listed ? "리스트됨" : "매각 개시"}
                    </span>
                  </button>
                );
              })()}
            </div>
          )}

          {/* 다른 회사 경매 목록 */}
          {state.auctions.length > 0 && (
            <>
              <p className="text-sm text-neutral">🔨 진행 중인 경매</p>
              {state.auctions.map((a) => {
                const co = state.companies[a.companyOwnerId];
                if (!co) return null;
                const isMine = a.companyOwnerId === selfId;
                const top = a.topBid;
                const nextBid = Math.max(
                  a.minBid,
                  (top?.amount ?? 0) + BALANCE.minBidIncrement
                );
                const affordable = (self?.cash ?? 0) >= nextBid;
                return (
                  <div
                    key={a.companyOwnerId}
                    className="rounded-card border-2 border-cardEdge bg-card p-3 flex flex-col gap-2"
                  >
                    <div className="flex items-center gap-3">
                      <span className="mascot">{SECTOR_MASCOTS[co.sector]}</span>
                      <div className="flex-1">
                        <p className="font-medium">{co.name}</p>
                        <p className="text-xs text-neutral">
                          {SECTOR_LABELS[co.sector]} · 최소가 {fmt(a.minBid)}
                        </p>
                      </div>
                    </div>
                    <div className="text-sm">
                      현재 최고가:{" "}
                      <span className="font-medium tabular-nums">
                        {top ? fmt(top.amount) : "—"}
                      </span>
                      {top && (
                        <span className="text-neutral">
                          {" "}
                          ({state.players.find((p) => p.id === top.bidderId)?.nickname})
                        </span>
                      )}
                    </div>
                    {!isMine && (
                      <button
                        disabled={!affordable}
                        onClick={() =>
                          send({
                            type: "bidExit",
                            targetOwnerId: a.companyOwnerId,
                            amount: nextBid,
                          })
                        }
                        className="rounded-element bg-warning text-ink px-3 py-2 font-medium text-sm disabled:opacity-40"
                      >
                        🔨 입찰 {fmt(nextBid)}
                      </button>
                    )}
                  </div>
                );
              })}
            </>
          )}

          <p className="text-xs text-neutral">
            현금 {fmt(self?.cash ?? 0)} · 시간이 끝나면 자동으로 다음 회차
          </p>
        </section>
      ) : isTrade ? (
        <section className="flex flex-col gap-3">
          <p className="text-sm text-neutral">
            매수/매도하면 거래량에 따라 주가가 즉시 변동합니다.
            한 번에 {BALANCE.liveTradeStep}주씩 · 꾹 누르면 반복.
          </p>
          {/* 뷰 모드 토글 */}
          <div className="flex gap-1 p-1 rounded-element border-2 border-cardEdge bg-paper">
            <button
              onClick={() => setTradeView("all")}
              className={`flex-1 rounded-element px-3 py-1.5 text-sm font-medium ${
                tradeView === "all"
                  ? "bg-ink text-paper"
                  : "text-neutral"
              }`}
            >
              전체 종목
            </button>
            <button
              onClick={() => {
                setTradeView("detail");
                if (!focusCompanyId) {
                  const first = state.players.find(
                    (p) => state.companies[p.id]
                  )?.id;
                  if (first) setFocusCompanyId(first);
                }
              }}
              className={`flex-1 rounded-element px-3 py-1.5 text-sm font-medium ${
                tradeView === "detail"
                  ? "bg-ink text-paper"
                  : "text-neutral"
              }`}
            >
              상세 보기
            </button>
          </div>
          {/* 상세 뷰: 종목 선택 chips + 큰 차트 */}
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
                          {SECTOR_MASCOTS[co.sector]}
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
                const livePct =
                  start > 0 ? ((co.price - start) / start) * 100 : 0;
                const isMine = cid === selfId;
                return (
                  <div className="rounded-card border-2 border-cardEdge bg-card p-4 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <span className="text-4xl">
                        {SECTOR_MASCOTS[co.sector]}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-lg font-medium truncate">
                          {co.name}
                          {isMine && (
                            <span className="ml-2 text-xs text-warning">
                              내 회사
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-neutral">
                          {SECTOR_LABELS[co.sector]} · Lv{co.techLevel} · ★
                          {co.trust} · {owner?.declaration ?? "—"}
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
                          send({
                            type: "trade",
                            companyOwnerId: cid,
                            shares: step,
                          })
                        }
                        className="flex-1 rounded-element bg-success text-paper px-3 py-3 font-medium"
                      >
                        매수 +{step}
                      </HoldButton>
                      <HoldButton
                        onFire={() =>
                          send({
                            type: "trade",
                            companyOwnerId: cid,
                            shares: -step,
                          })
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
          {/* 전체 뷰: 카드 그리드 */}
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
                    <span className="mascot">{SECTOR_MASCOTS[co.sector]}</span>
                    <div className="flex-1">
                      <p className="font-medium">
                        {co.name}
                        {isMine && (
                          <span className="ml-2 text-xs text-warning">
                            내 회사
                          </span>
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
      ) : isPosition ? (
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
              // 클램프: 매도는 보유까지만, 자기 회사 매수는 60% 상한까지만.
              const minQty = -held;
              const selfCap = Math.floor(
                co.sharesOutstanding * BALANCE.maxSelfOwnership
              );
              const maxQty = isMine ? selfCap - held : 9999;
              const step = BALANCE.liveTradeStep; // 한 클릭 = 10주
              const canDecr = qty - step >= minQty;
              const canIncr = qty + step <= maxQty;
              return (
                <div
                  key={other.id}
                  className="rounded-card border-2 border-cardEdge bg-card p-3 flex flex-col gap-2"
                >
                  <div className="flex items-center gap-3">
                    <span className="mascot">{SECTOR_MASCOTS[co.sector]}</span>
                    <div className="flex-1">
                      <p className="font-medium">
                        {co.name}
                        {isMine && (
                          <span className="ml-2 text-xs text-warning">
                            내 회사
                          </span>
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
          {(() => {
            const totalCost = Object.entries(positionOrders).reduce(
              (sum, [cid, n]) => {
                const co = state.companies[cid];
                return sum + (co ? co.price * n : 0);
              },
              0
            );
            const myCash = self?.cash ?? 0;
            const overCash = totalCost > myCash;
            return (
              <>
                <div className="text-xs text-neutral">
                  예상 투입{" "}
                  <span
                    className={`font-medium ${overCash ? "text-danger" : ""}`}
                  >
                    {fmt(totalCost)}
                  </span>{" "}
                  · 현금 {fmt(myCash)}
                  {overCash && (
                    <span className="text-danger ml-1">· 잔액 부족</span>
                  )}
                </div>
                <button
                  disabled={self?.ready || overCash}
                  onClick={() => {
                    const orders = Object.entries(positionOrders)
                      .filter(([, n]) => n !== 0)
                      .map(([companyOwnerId, shares]) => ({
                        companyOwnerId,
                        shares,
                      }));
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
              </>
            );
          })()}
          <p className="text-xs text-neutral">
            확정 완료 {readyCount} / {connected.length}
          </p>
        </section>
      ) : isDeclare ? (
        <section className="flex flex-col gap-3">
          <p className="text-sm text-neutral">
            전망 카드 1장을 공개로 낸다 (진실 의무 없음)
          </p>
          {(["HYPE", "WARN", "SILENT"] as const).map((d) => {
            const labels = {
              HYPE: { title: "HYPE · 떡상 예고", desc: "호재 예고 → 따라사기 유도", color: "text-success" },
              WARN: { title: "WARN · 위기 경고", desc: "악재 예고 → 던지게 유도", color: "text-danger" },
              SILENT: { title: "SILENT · 침묵", desc: "신뢰도 변동 없음", color: "text-neutral" },
            }[d];
            const selected = self?.declaration === d;
            return (
              <button
                key={d}
                onClick={() =>
                  send({
                    type: "declare",
                    declaration: d,
                    comment: declareComment.trim() || undefined,
                  })
                }
                className={`rounded-element border px-3 py-3 text-left ${
                  selected
                    ? "border-warning bg-warning/10"
                    : "border-neutral/30"
                }`}
              >
                <div className={`font-medium ${labels.color}`}>{labels.title}</div>
                <div className="text-xs text-neutral">{labels.desc}</div>
              </button>
            );
          })}

          {/* 코멘트 입력 (모든 플레이어에게 공개) */}
          <div className="flex flex-col gap-1">
            <label htmlFor="declaim" className="text-xs text-neutral">
              💬 코멘트 (선택 · 최대 60자 · 모두에게 공개)
            </label>
            <input
              id="declaim"
              value={declareComment}
              onChange={(e) => setDeclareComment(e.target.value.slice(0, 60))}
              placeholder="예) 진짜 대박이다, 이번엔 확실함…"
              className="rounded-element border-2 border-cardEdge bg-card px-3 py-2 text-sm"
            />
            {self?.declaration && (
              <p className="text-xs text-neutral">
                선언 이미 완료. 코멘트 수정하려면 카드를 다시 눌러 재제출.
              </p>
            )}
          </div>

          {/* 다른 플레이어의 선언 + 코멘트 실시간 표시 */}
          <div className="flex flex-col gap-2">
            <p className="text-xs text-neutral">
              💬 다른 사람 선언 / 코멘트
            </p>
            {state.players
              .filter((p) => p.declaration && p.id !== selfId)
              .map((p) => {
                const co = state.companies[p.id];
                const badgeCls =
                  p.declaration === "HYPE"
                    ? "text-success"
                    : p.declaration === "WARN"
                      ? "text-danger"
                      : "text-neutral";
                return (
                  <div
                    key={p.id}
                    className="rounded-element border-2 border-cardEdge bg-card p-2 flex flex-col gap-1"
                  >
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1.5">
                        {co && (
                          <span className="mascot text-lg">
                            {SECTOR_MASCOTS[co.sector]}
                          </span>
                        )}
                        {p.isBot && "🤖 "}
                        <span className="font-medium">{p.nickname}</span>
                      </span>
                      <span className={`text-xs font-medium ${badgeCls}`}>
                        {p.declaration}
                      </span>
                    </div>
                    {p.declarationComment && (
                      <p className="text-xs pl-1">
                        “{p.declarationComment}”
                      </p>
                    )}
                  </div>
                );
              })}
            {state.players.filter((p) => p.declaration && p.id !== selfId)
              .length === 0 && (
              <p className="text-xs text-neutral italic">
                아직 다른 플레이어의 선언이 없어요.
              </p>
            )}
          </div>

          <p className="text-xs text-neutral">
            선언 완료 {readyCount} / {connected.length}
          </p>
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          {isInfo && self?.privateInfo && (
            <>
              {/* 정보 카드 캐러셀: 가로 스와이프, 한 번에 한 장씩 */}
              {(() => {
                // [내 정보, 구매한 정보들] 을 하나의 카드 리스트로 통합
                const cards: Array<{
                  key: string;
                  ownerId: string;
                  isMine: boolean;
                  direction: "BULLISH" | "BEARISH";
                }> = [
                  {
                    key: `self-${selfId}`,
                    ownerId: selfId ?? "",
                    isMine: true,
                    direction: self.privateInfo,
                  },
                  ...(self.purchasedInfos ?? []).map((info) => ({
                    key: `p-${info.ownerId}`,
                    ownerId: info.ownerId,
                    isMine: false,
                    direction: info.direction,
                  })),
                ];
                return (
                  <div className="flex flex-col gap-2">
                    <div className="flex justify-between items-baseline">
                      <p className="text-sm font-medium">
                        📇 이번 회차 정보 카드
                      </p>
                      <p className="text-xs text-neutral">
                        {cards.length}장 · 좌우로 넘겨보세요
                      </p>
                    </div>
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
                                {co ? SECTOR_MASCOTS[co.sector] : "❓"}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="font-medium truncate">
                                  {co?.name ?? "—"}
                                </p>
                                <p className="text-xs text-neutral">
                                  {co ? SECTOR_LABELS[co.sector] : ""}
                                </p>
                              </div>
                            </div>
                            <div className="text-center py-2">
                              <p
                                className={`text-3xl font-medium ${
                                  isUp ? "text-success" : "text-danger"
                                }`}
                              >
                                {isUp
                                  ? "호재 ▲ 상승 예고"
                                  : "악재 ▼ 하락 예고"}
                              </p>
                            </div>
                            <p className="text-xs text-neutral text-center">
                              강도는 비공개 · 나만 볼 수 있는 정보
                            </p>
                          </div>
                        );
                      })}
                    </div>
                    {/* 페이지 도트 */}
                    <div className="flex justify-center gap-1.5">
                      {cards.map((c) => (
                        <span
                          key={c.key}
                          className="w-1.5 h-1.5 rounded-full bg-neutral/40"
                        />
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* 정보 구매 버튼들 */}
              <div className="rounded-card border border-neutral/20 p-3 flex flex-col gap-2">
                <div className="flex justify-between items-baseline">
                  <p className="text-xs text-neutral">정보 구매</p>
                  <p className="text-xs text-neutral">
                    {self.purchasedInfos?.length ?? 0} / {BALANCE.infoBuyMax} ·{" "}
                    {fmt(BALANCE.infoBuyCost)}/건
                  </p>
                </div>
                {state.players
                  .filter((other) => other.id !== selfId && state.companies[other.id])
                  .map((other) => {
                    const co = state.companies[other.id];
                    const owned = self.purchasedInfos?.some(
                      (x) => x.ownerId === other.id
                    );
                    const maxed =
                      (self.purchasedInfos?.length ?? 0) >= BALANCE.infoBuyMax;
                    const tooPoor = self.cash < BALANCE.infoBuyCost;
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
                            {SECTOR_MASCOTS[co.sector]}
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
                <p className="text-xs text-neutral">
                  현금 {fmt(self.cash)}
                </p>
              </div>
            </>
          )}
          {isSettle && (
            <div className="flex flex-col gap-3">
              <div className="rounded-card border-2 border-info bg-info/10 p-3">
                <p className="text-xs text-neutral">🔔 회차 {state.round} 장 마감</p>
                <p className="text-lg font-medium">최종 종가</p>
                <ul className="mt-2 flex flex-col gap-1">
                  {state.players
                    .filter((p) => state.companies[p.id])
                    .map((p) => {
                      const co = state.companies[p.id];
                      const prev = co.prevSettlePrice ?? co.price;
                      const pct = prev > 0 ? ((co.price - prev) / prev) * 100 : 0;
                      return (
                        <li
                          key={p.id}
                          className="flex justify-between text-sm"
                        >
                          <span>
                            <span className="mascot mr-1">
                              {SECTOR_MASCOTS[co.sector]}
                            </span>
                            {co.name}
                          </span>
                          <span className="tabular-nums">
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
              <p className="text-sm text-neutral">📊 회차 {state.round} 결과</p>
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
                        isMine
                          ? "border-warning bg-accentSoft"
                          : "border-cardEdge bg-card"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span className="mascot">
                          {SECTOR_MASCOTS[co.sector]}
                        </span>
                        <div className="flex-1">
                          <p className="font-medium">
                            {co.name}
                            {isMine && (
                              <span className="ml-2 text-xs text-warning">
                                내 회사
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-neutral">
                            {SECTOR_LABELS[co.sector]} ·{" "}
                            {other.declaration ?? "—"}
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
                      <Sparkline
                        points={co.pricePoints ?? []}
                        width={330}
                        height={44}
                      />
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
                        {co.researchBreakthroughThisRound && (
                          <span className="rounded-element bg-success/10 border border-success/30 text-success px-2 py-1">
                            🔬 연구 성공
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              {self && (
                <div className="rounded-card border-2 border-info bg-info/5 p-3">
                  <p className="text-xs text-neutral">내 자산 (총)</p>
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
          )}
          <p className="text-sm text-neutral">
            준비 완료 {readyCount} / {connected.length}
          </p>
          <button
            disabled={self?.ready}
            onClick={() => send({ type: "ready" })}
            className="rounded-element bg-success px-4 py-3 text-paper font-medium disabled:opacity-40"
          >
            {self?.ready ? "준비됨 · 다른 사람 대기 중" : "준비 완료"}
          </button>
          <p className="text-xs text-neutral">
            전원이 준비하면 타이머 없이 바로 다음 페이즈로 넘어갑니다.
          </p>
        </section>
      )}

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
                      {SECTOR_MASCOTS[co.sector]}
                    </span>
                  )}
                  <span>
                    {p.nickname}
                    {p.id === selfId && (
                      <span className="ml-1 text-xs text-warning">(나)</span>
                    )}
                    {co && (
                      <span className="block text-xs text-neutral">
                        {co.name}
                      </span>
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

      <section className="flex flex-col gap-2">
        <p className="text-sm text-neutral">진행 로그</p>
        <ul className="flex flex-col gap-1">
          {recentLog.map((entry, i) => (
            <li key={i} className="text-sm">
              <span className="text-neutral">R{entry.round} · </span>
              {entry.text}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
