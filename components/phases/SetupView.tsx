"use client";

import { useEffect, useState } from "react";
import { BALANCE } from "@/game/balance";
import { SECTORS, SECTOR_LABELS } from "@/game/types";
import type { Sector } from "@/game/types";
import SectorIcon from "../SectorIcon";
import { fmt, type PhaseViewProps } from "./phaseCommon";

// SETUP 페이즈: 카테고리 선택 + 회사 이름 + 창업 출자 슬라이더.
// 로컬 폼 상태(sector/bizName/seedManwon)는 여기 안에서만 관리.
export default function SetupView({
  self,
  send,
  myCompany,
  connected,
  readyCount,
  state,
}: PhaseViewProps) {
  const [sector, setSector] = useState<Sector | null>(null);
  const [bizName, setBizName] = useState("");
  const [seedManwon, setSeedManwon] = useState(0);

  // SETUP 이 새로 시작될 때 폼 초기화 (재시작 등에서 잔여 상태 방지).
  useEffect(() => {
    if (state.phase === "SETUP") {
      setSector(null);
      setBizName("");
      setSeedManwon(0);
    }
  }, [state.phase]);

  // 내가 고른 섹터를 다른 플레이어(봇 포함)가 먼저 잡으면 자동 해제.
  // 봇 자동 SETUP 은 1.2초 지연이라 인간이 이미 골랐을 수 있어서 필요.
  useEffect(() => {
    if (!sector) return;
    const takenByOther = Object.values(state.companies).some(
      (c) => c.sector === sector && c.ownerId !== self?.id
    );
    if (takenByOther) setSector(null);
  }, [state.companies, sector, self?.id]);

  const canSubmitSetup = sector !== null && bizName.trim().length > 0;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <p className="font-medium">내 사업 만들기</p>
        <p className="text-sm text-neutral">
          카테고리를 고르고 회사 이름을 정하세요. 시작 시총은 모두 같습니다.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {SECTORS.map((s) => {
          // 이 섹터를 소유한 회사 (있으면 = 그 플레이어가 확정한 것).
          const takenCo = Object.values(state.companies).find(
            (c) => c.sector === s
          );
          const takenByMe = takenCo?.ownerId === self?.id;
          const takenByOther = !!takenCo && !takenByMe;
          const owner = takenCo
            ? state.players.find((p) => p.id === takenCo.ownerId)
            : undefined;
          const picked = sector === s && !takenByOther;
          return (
            <button
              key={s}
              onClick={() => !takenByOther && setSector(s)}
              disabled={takenByOther}
              title={
                takenByOther
                  ? `${owner?.nickname ?? "다른 플레이어"} 확정`
                  : undefined
              }
              className={`rounded-card border-2 px-3 py-2 text-sm font-medium flex flex-col items-stretch gap-1 relative ${
                takenByMe
                  ? "border-success bg-success/10 text-ink"
                  : picked
                    ? "border-warning bg-accentSoft text-ink"
                    : takenByOther
                      ? "border-cardEdge/40 bg-card/60 text-neutral cursor-not-allowed"
                      : "border-cardEdge bg-card text-ink"
              }`}
            >
              <div className="flex items-center gap-2">
                <SectorIcon sector={s} size={32} />
                <span className={takenByOther ? "line-through" : ""}>
                  {SECTOR_LABELS[s]}
                </span>
              </div>
              {/* 오너 배지 (닉네임 + 확정 표시) */}
              {owner ? (
                <div
                  className={`flex items-center gap-1 text-[10px] rounded-element px-1.5 py-0.5 ${
                    takenByMe
                      ? "bg-success text-paper"
                      : "bg-neutral/20 text-neutral"
                  }`}
                >
                  <span>👤</span>
                  <span className="truncate flex-1 text-left font-medium">
                    {owner.nickname}
                    {takenByMe && " (나)"}
                    {owner.isBot && " 🤖"}
                  </span>
                  <span className="font-bold">✓</span>
                </div>
              ) : (
                <div className="text-[10px] text-neutral text-left px-0.5">
                  {picked ? "🟡 선택됨 · 확정 대기" : "· 비어 있음"}
                </div>
              )}
            </button>
          );
        })}
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
          내 회사에 박는 자본. 많이 넣을수록 회사가 안정적으로 운영되고,
          적을수록 그래프 등락이 커집니다.
          매 회차 정산 시 출자 비율만큼 최대 +
          {(BALANCE.seedGrowthMax * 100).toFixed(1)}% 성장 보너스.
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
  );
}
