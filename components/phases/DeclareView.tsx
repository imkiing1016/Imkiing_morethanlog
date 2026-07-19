"use client";

import { useEffect, useState } from "react";
import SectorIcon from "../SectorIcon";
import { type PhaseViewProps } from "./phaseCommon";

// DECLARE 페이즈: HYPE/WARN/SILENT 3택 + 코멘트. 투자자면 준비 완료만.
export default function DeclareView({
  state,
  self,
  selfId,
  send,
  myCompany,
  connected,
  readyCount,
}: PhaseViewProps) {
  const [declareComment, setDeclareComment] = useState("");

  // DECLARE 이 아닌 페이즈로 넘어가면 코멘트 리셋.
  useEffect(() => {
    if (state.phase !== "DECLARE") setDeclareComment("");
  }, [state.phase]);

  // 회사 없는 투자자: 선언 없이 준비만.
  if (!myCompany && self?.isInvestor) {
    return (
      <section className="flex flex-col gap-3">
        <p className="text-sm text-neutral">
          💼 투자자에게는 선언할 회사가 없어요. 다른 사람의 선언을 지켜보다가 준비되면 넘겨주세요.
        </p>
        <button
          onClick={() => send({ type: "ready" })}
          disabled={self?.ready}
          className={`rounded-element border-2 px-3 py-3 text-left ${
            self?.ready
              ? "border-success bg-success/10 text-success"
              : "border-cardEdge bg-card"
          } disabled:opacity-60`}
        >
          {self?.ready ? "✅ 준비 완료" : "▶ 준비 완료"}
        </button>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <p className="text-sm text-neutral">전망 카드 1장을 공개로 낸다 (진실 의무 없음)</p>
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
              selected ? "border-warning bg-warning/10" : "border-neutral/30"
            }`}
          >
            <div className={`font-medium ${labels.color}`}>{labels.title}</div>
            <div className="text-xs text-neutral">{labels.desc}</div>
          </button>
        );
      })}

      {/* 코멘트 (공개) */}
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

      {/* 다른 플레이어 선언 */}
      <div className="flex flex-col gap-2">
        <p className="text-xs text-neutral">💬 다른 사람 선언 / 코멘트</p>
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
                        {<SectorIcon sector={co.sector} size={24} />}
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
                  <p className="text-xs pl-1">“{p.declarationComment}”</p>
                )}
              </div>
            );
          })}
        {state.players.filter((p) => p.declaration && p.id !== selfId).length ===
          0 && (
          <p className="text-xs text-neutral italic">
            아직 다른 플레이어의 선언이 없어요.
          </p>
        )}
      </div>

      <p className="text-xs text-neutral">
        선언 완료 {readyCount} / {connected.length}
      </p>
    </section>
  );
}
