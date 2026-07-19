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
            <SectorIcon sector={s} size={32} />
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
          {(BALANCE.seedGrowthMax * 100).toFixed(1)}% 추가 성장 보너스(출자 비율만큼).
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
