"use client";

import { useEffect, useState } from "react";
import { useGameStore } from "@/lib/store";
import { SECTORS, SECTOR_LABELS } from "@/game/types";
import type { ClientMessage, Phase, Sector } from "@/game/types";
import { BALANCE } from "@/game/balance";

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
  MANAGE: "관리",
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
  MANAGE: "text-neutral",
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

  if (!state) return null;

  const self = state.players.find((p) => p.id === selfId);
  const isSetup = state.phase === "SETUP";
  const isInfo = state.phase === "INFO";
  const isPosition = state.phase === "POSITION";
  const isDeclare = state.phase === "DECLARE";
  const isSettle = state.phase === "SETTLE";
  const isTrade = state.phase === "TRADE";
  const isEnded = state.phase === "ENDED";
  const connected = state.players.filter((p) => p.connected);
  const readyCount = connected.filter((p) => p.ready).length;

  const secondsLeft =
    isTrade && state.phaseDeadline
      ? Math.max(0, Math.ceil((state.phaseDeadline - now) / 1000))
      : null;

  const recentLog = state.log.slice(-6).reverse();
  const myCompany = selfId ? state.companies[selfId] : undefined;
  const canSubmitSetup = sector !== null && bizName.trim().length > 0;

  return (
    <main className="flex flex-col gap-6 pt-8">
      <header className="flex items-center justify-between">
        <div className="flex flex-col gap-1">
          {state.round >= 1 && (
            <p className="text-sm text-neutral">
              회차 {state.round} / {state.maxRounds}
            </p>
          )}
          <p className={`text-2xl font-medium ${PHASE_ACCENT[state.phase]}`}>
            {PHASE_LABEL[state.phase]} 페이즈
          </p>
        </div>
        {secondsLeft !== null && (
          <span className="text-2xl font-medium text-success tabular-nums">
            {secondsLeft}s
          </span>
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
                className={`rounded-element border px-3 py-3 text-sm font-medium ${
                  sector === s
                    ? "border-warning bg-warning/10 text-ink"
                    : "border-neutral/30 text-ink"
                }`}
              >
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
        <section className="rounded-card border border-neutral/20 p-4">
          <p className="font-medium">게임 종료</p>
          <p className="text-sm text-neutral">
            마지막 회차까지 순환을 마쳤습니다. (승리화면은 M7)
          </p>
        </section>
      ) : isTrade ? (
        <section className="flex flex-col gap-3">
          <p className="text-sm text-neutral">
            매수/매도하면 거래량에 따라 주가가 즉시 변동합니다.
            한 번에 {BALANCE.liveTradeStep}주씩 체결.
          </p>
          {state.players
            .filter((other) => state.companies[other.id])
            .map((other) => {
              const co = state.companies[other.id];
              const held = self?.holdings?.[other.id] ?? 0;
              const isMine = other.id === selfId;
              const step = BALANCE.liveTradeStep;
              return (
                <div
                  key={other.id}
                  className="rounded-card border border-neutral/20 p-3 flex flex-col gap-2"
                >
                  <div className="flex justify-between items-baseline">
                    <span className="font-medium">
                      {co.name}
                      <span className="ml-2 text-xs text-neutral">
                        ({SECTOR_LABELS[co.sector]}){isMine && " · 내 회사"}
                      </span>
                    </span>
                    <span className="tabular-nums font-medium">
                      {fmt(co.price)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs text-neutral">
                    <span>
                      보유 {held}주 ({co.trust}/5★ ·{" "}
                      {other.declaration ?? "—"})
                    </span>
                    <span>1주 {fmt(co.price)}</span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        send({
                          type: "trade",
                          companyOwnerId: other.id,
                          shares: step,
                        })
                      }
                      className="flex-1 rounded-element bg-success/10 border border-success/40 text-success px-3 py-2 font-medium text-sm"
                    >
                      매수 +{step}
                    </button>
                    <button
                      onClick={() =>
                        send({
                          type: "trade",
                          companyOwnerId: other.id,
                          shares: -step,
                        })
                      }
                      className="flex-1 rounded-element bg-danger/10 border border-danger/40 text-danger px-3 py-2 font-medium text-sm"
                    >
                      매도 −{step}
                    </button>
                  </div>
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
              return (
                <div
                  key={other.id}
                  className="rounded-card border border-neutral/20 p-3 flex flex-col gap-2"
                >
                  <div className="flex justify-between items-baseline">
                    <span className="font-medium">
                      {co.name}
                      <span className="ml-2 text-xs text-neutral">
                        ({SECTOR_LABELS[co.sector]}){isMine && " · 내 회사"}
                      </span>
                    </span>
                    <span className="tabular-nums">{fmt(co.price)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-neutral">
                      현 보유 {self?.holdings?.[other.id] ?? 0}주
                    </span>
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() =>
                          setPositionOrders((o) => ({
                            ...o,
                            [other.id]: (o[other.id] ?? 0) - 1,
                          }))
                        }
                        className="w-9 h-9 rounded-element border border-neutral/30 font-medium"
                      >
                        −
                      </button>
                      <span
                        className={`tabular-nums min-w-[2.5rem] text-center font-medium ${
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
                        onClick={() =>
                          setPositionOrders((o) => ({
                            ...o,
                            [other.id]: (o[other.id] ?? 0) + 1,
                          }))
                        }
                        className="w-9 h-9 rounded-element border border-neutral/30 font-medium"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          <div className="text-xs text-neutral">
            예상 투입{" "}
            <span className="font-medium">
              {fmt(
                Object.entries(positionOrders).reduce((sum, [cid, n]) => {
                  const co = state.companies[cid];
                  return sum + (co ? co.price * n : 0);
                }, 0)
              )}
            </span>{" "}
            · 현금 {fmt(self?.cash ?? 0)}
          </div>
          <button
            disabled={self?.ready}
            onClick={() => {
              const orders = Object.entries(positionOrders)
                .filter(([, n]) => n !== 0)
                .map(([companyOwnerId, shares]) => ({
                  companyOwnerId,
                  shares,
                }));
              send({ type: "submitPosition", orders });
            }}
            className="rounded-element bg-danger px-4 py-3 text-paper font-medium disabled:opacity-40"
          >
            {self?.ready ? "포지션 확정됨 · 대기 중" : "포지션 확정 (비공개)"}
          </button>
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
                onClick={() => send({ type: "declare", declaration: d })}
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
          <p className="text-xs text-neutral">
            선언 완료 {readyCount} / {connected.length}
          </p>
        </section>
      ) : (
        <section className="flex flex-col gap-3">
          {isInfo && self?.privateInfo && (
            <>
              <div className="rounded-card border border-danger/30 bg-danger/5 p-4">
                <p className="text-xs text-neutral">
                  회차 {state.round} 정산 · 내 회사 정보 (비공개)
                </p>
                <p
                  className={`text-2xl font-medium ${
                    self.privateInfo === "BULLISH"
                      ? "text-success"
                      : "text-danger"
                  }`}
                >
                  {self.privateInfo === "BULLISH"
                    ? "호재 ▲ 상승 예고"
                    : "악재 ▼ 하락 예고"}
                </p>
                <p className="text-xs text-neutral">
                  강도는 비공개 · 이 정보는 나만 봅니다
                </p>
              </div>

              {/* 산 정보 표시 */}
              {self.purchasedInfos && self.purchasedInfos.length > 0 && (
                <div className="rounded-card border border-neutral/20 p-3">
                  <p className="text-xs text-neutral">구매한 정보</p>
                  <ul className="flex flex-col gap-1 mt-1">
                    {self.purchasedInfos.map((info) => {
                      const co = state.companies[info.ownerId];
                      if (!co) return null;
                      return (
                        <li
                          key={info.ownerId}
                          className="flex justify-between text-sm"
                        >
                          <span>
                            {co.name} ({SECTOR_LABELS[co.sector]})
                          </span>
                          <span
                            className={
                              info.direction === "BULLISH"
                                ? "text-success"
                                : "text-danger"
                            }
                          >
                            {info.direction === "BULLISH"
                              ? "호재 ▲"
                              : "악재 ▼"}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}

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
                        <span>
                          {co.name}{" "}
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
          {isSettle && myCompany && (
            <div className="rounded-card border border-info/30 bg-info/5 p-4">
              <p className="text-xs text-neutral">정산 결과 · 내 회사</p>
              <p className="text-lg font-medium">
                {myCompany.name} · {fmt(myCompany.price)}
              </p>
              <p className="text-xs text-neutral">신뢰도 ★ {myCompany.trust}</p>
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
                className="flex items-center justify-between rounded-element border border-neutral/20 px-3 py-2 text-sm"
              >
                <span className="font-medium">
                  {p.nickname}
                  {p.id === selfId && (
                    <span className="ml-2 text-neutral">(나)</span>
                  )}
                  {co && (
                    <span className="ml-2 text-neutral">
                      · {co.name} ({SECTOR_LABELS[co.sector]})
                    </span>
                  )}
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
