"use client";

import { useState } from "react";
import { useGameStore } from "@/lib/store";

// 우측 상단 확성기 아이콘 버튼 — 눌리면 사이드 패널로 이 게임의 모든 뉴스 기록 표시.
// 잠깐 놓친 뉴스도 되돌아 볼 수 있게. 회차별로 그룹핑, 스포트라이트는 별도 강조.

export default function NewsHistoryButton() {
  const news = useGameStore((s) => s.state?.newsEvents ?? []);
  const currentRound = useGameStore((s) => s.state?.round ?? 0);
  const [open, setOpen] = useState(false);

  // LOBBY 진입 전 등 뉴스도 없고 패널 안 열려 있으면 UI 노출 안 함.
  if (news.length === 0 && !open) return null;

  // 최신 뉴스가 위에 오도록 역순.
  const sorted = [...news].reverse();

  // 회차별 그룹핑 (round 없는 이벤트는 회차 0 = "게임 시작 전"에 몰음).
  const grouped = new Map<number, typeof sorted>();
  for (const n of sorted) {
    const r = n.round ?? 0;
    if (!grouped.has(r)) grouped.set(r, []);
    grouped.get(r)!.push(n);
  }
  const rounds = Array.from(grouped.keys()).sort((a, b) => b - a);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={`뉴스 기록 ${news.length}건`}
        className="fixed top-3 right-3 z-50 w-11 h-11 rounded-full border-2 border-cardEdge bg-card shadow-md flex items-center justify-center text-xl active:scale-95 transition-transform news-btn"
      >
        📢
        {news.length > 0 && (
          <span className="absolute -top-1 -right-1 bg-warning text-ink text-[10px] leading-none rounded-full min-w-[18px] h-[18px] px-1 flex items-center justify-center border border-cardEdge font-medium">
            {news.length > 99 ? "99+" : news.length}
          </span>
        )}
        <style jsx>{`
          .news-btn {
            animation: none;
          }
          .news-btn:hover {
            transform: scale(1.05);
          }
        `}</style>
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[60] flex justify-end"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-label="뉴스 기록"
        >
          <div className="absolute inset-0 bg-black/40 news-panel-fade" />
          <div
            className="relative bg-paper border-l-2 border-cardEdge w-full max-w-md h-full flex flex-col shadow-2xl news-panel-slide"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-3 border-b-2 border-cardEdge flex justify-between items-center bg-card">
              <div>
                <p className="font-medium">📢 뉴스 기록</p>
                <p className="text-xs text-neutral">
                  총 {news.length}건 · 이번 회차 R{currentRound}
                </p>
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-element border-2 border-cardEdge bg-paper px-3 py-1 text-sm active:scale-95"
              >
                닫기
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 flex flex-col gap-4">
              {rounds.length === 0 ? (
                <p className="text-sm text-neutral text-center py-8">
                  아직 뉴스가 없어요.
                </p>
              ) : (
                rounds.map((r) => (
                  <div key={r} className="flex flex-col gap-1.5">
                    <p className="text-xs text-neutral font-medium sticky top-0 bg-paper py-1 border-b border-cardEdge">
                      {r === 0
                        ? "🎬 게임 시작 전"
                        : `📅 회차 ${r}${r === currentRound ? " · 진행 중" : ""}`}
                    </p>
                    {grouped.get(r)!.map((n) => (
                      <div
                        key={n.id}
                        className={`rounded-element border-2 p-2 ${
                          n.tone === "good"
                            ? "border-success/40 bg-success/10"
                            : n.tone === "bad"
                              ? "border-danger/40 bg-danger/10"
                              : "border-cardEdge bg-card"
                        } ${
                          n.spotlight ? "ring-2 ring-warning ring-offset-1" : ""
                        }`}
                      >
                        <div className="flex gap-2">
                          <span className="text-lg leading-none flex-shrink-0">
                            {n.emoji}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium leading-tight">
                              {n.headline}
                            </p>
                            {n.detail && (
                              <p className="text-xs text-neutral mt-0.5 leading-snug">
                                {n.detail}
                              </p>
                            )}
                            {n.flavorQuote && (
                              <p className="text-xs italic mt-1 text-ink/80 leading-snug">
                                “{n.flavorQuote}”
                              </p>
                            )}
                            {n.spotlight && (
                              <p className="text-[10px] text-warning mt-1 font-medium">
                                ✨ 주요 이벤트
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ))
              )}
            </div>
          </div>

          <style jsx>{`
            .news-panel-fade {
              animation: news-panel-fade-in 200ms ease-out;
            }
            .news-panel-slide {
              animation: news-panel-slide-in 260ms cubic-bezier(0.2, 1, 0.4, 1);
            }
            @keyframes news-panel-fade-in {
              from {
                opacity: 0;
              }
              to {
                opacity: 1;
              }
            }
            @keyframes news-panel-slide-in {
              from {
                transform: translateX(100%);
              }
              to {
                transform: translateX(0);
              }
            }
          `}</style>
        </div>
      )}
    </>
  );
}
