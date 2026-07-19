"use client";

import SectorIcon from "../SectorIcon";
import { fmt, type PhaseViewProps } from "./phaseCommon";

// ENDED 페이즈: 최종 우승자 + 시상대 + 랭킹 + 리매치 버튼.
export default function EndedView({ state, selfId, send }: PhaseViewProps) {
  const rankings = state.finalRankings ?? [];
  const winner = rankings[0];
  const podium = rankings.slice(0, 3);
  const medals = ["🥇", "🥈", "🥉"];
  const isHost = selfId === state.hostId;
  const heights: Record<0 | 1 | 2, string> = {
    0: "h-24",
    1: "h-16",
    2: "h-12",
  };

  return (
    <section className="flex flex-col gap-4">
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
            return (
              <div key={p.playerId} className="flex flex-col items-center gap-1">
                <div className="text-2xl">{medals[idx]}</div>
                <p className="text-sm font-medium text-center">{p.nickname}</p>
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
                  {isMe && <span className="text-xs text-warning">(나)</span>}
                  {co && (
                    <span className="mascot">
                      {<SectorIcon sector={co.sector} size={24} />}
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
        <p className="text-sm text-neutral">호스트가 리매치를 시작할 수 있어요.</p>
      )}

    </section>
  );
}
