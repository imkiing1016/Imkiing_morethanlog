"use client";

import { SECTOR_LABELS } from "@/game/types";
import type { CompanyHistoryEntry } from "@/game/types";
import SectorIcon from "../SectorIcon";
import { fmt, type PhaseViewProps } from "./phaseCommon";

// ENDED 페이즈: 최종 우승자 + 시상대 + 랭킹 + 리매치 버튼
//   + 전체 회고 그래프 (회사별 8회차 · 엑시트 마커) + 회차별 호가/폭락 심리 바.
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
  const history = state.companyHistory ?? [];
  const maxRounds = state.maxRounds;

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

      {/* === 회고 그래프 === */}
      {history.length > 0 && (
        <HistoryChart history={history} maxRounds={maxRounds} />
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

// 회사 라인 색상 팔레트 (6개 이상이면 순환).
const LINE_COLORS = [
  "#D8384E", // red
  "#F4A932", // gold
  "#5FA362", // sage
  "#4CA9E8", // sky
  "#7C3F86", // plum
  "#B57A2D", // brown
];

const EXIT_LABEL: Record<
  NonNullable<CompanyHistoryEntry["exitReason"]>,
  { label: string; icon: string }
> = {
  NATION: { label: "국가 매각", icon: "🏛️" },
  HAWK: { label: "매파 인수", icon: "🐺" },
  HEDGE: { label: "헤지펀드", icon: "🎭" },
  CHAEBOL: { label: "재벌 인수", icon: "🏢" },
  VC: { label: "VC 러브콜", icon: "🌟" },
  MYSTERY: { label: "비밀 매수자", icon: "🕵️" },
  BANK: { label: "은행 압류", icon: "🚨" },
};

// 회사별 배수 그래프 (0..maxRounds) + 회차별 호가/폭락 심리 바.
function HistoryChart({
  history,
  maxRounds,
}: {
  history: CompanyHistoryEntry[];
  maxRounds: number;
}) {
  // SVG viewBox 크기
  const W = 700;
  const H = 260;
  const padLeft = 44;
  const padRight = 60;
  const padTop = 18;
  const padBottom = 32;
  const plotW = W - padLeft - padRight;
  const plotH = H - padTop - padBottom;

  // Y축 범위 결정 (전 회사 배수 최소~최대). 최소 0.3~2.5 보장.
  let minMul = 0.5;
  let maxMul = 2.0;
  for (const e of history) {
    for (let i = 0; i < e.roundClosePrices.length; i++) {
      const mul = e.roundClosePrices[i] / (e.startingPrice || 1);
      if (mul < minMul) minMul = mul;
      if (mul > maxMul) maxMul = mul;
    }
  }
  // 여유 여백
  minMul = Math.max(0.05, minMul - 0.1);
  maxMul = maxMul + 0.15;

  function xForRound(r: number): number {
    // r 은 1..maxRounds
    if (maxRounds <= 1) return padLeft + plotW / 2;
    return padLeft + ((r - 1) / (maxRounds - 1)) * plotW;
  }
  function yForMul(mul: number): number {
    const t = (mul - minMul) / (maxMul - minMul);
    return padTop + (1 - t) * plotH;
  }
  const yBaseline = yForMul(1.0);

  // 회차별 시장 평균 변동률 (호가/폭락 심리 바).
  // 각 회차마다 그 회차 종가가 있는 회사들의 (종가/전회차종가)−1 을 평균.
  const roundSentiment: number[] = [];
  for (let r = 1; r <= maxRounds; r++) {
    let sum = 0;
    let count = 0;
    for (const e of history) {
      const idx = r - e.startRound;
      if (idx < 0 || idx >= e.roundClosePrices.length) continue;
      const cur = e.roundClosePrices[idx];
      const prev =
        idx === 0 ? e.startingPrice : e.roundClosePrices[idx - 1];
      if (prev <= 0) continue;
      sum += cur / prev - 1;
      count += 1;
    }
    roundSentiment.push(count > 0 ? sum / count : 0);
  }

  return (
    <div className="rounded-card border-2 border-cardEdge bg-card p-3 flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">📊 전 회사 · {maxRounds}회차 회고</p>
        <p className="text-xs text-neutral">시작가 대비 배수 · 엑시트 마커</p>
      </div>

      {/* 범례 */}
      <div className="grid grid-cols-2 gap-1 text-xs">
        {history.map((e, i) => {
          const color = LINE_COLORS[i % LINE_COLORS.length];
          const lastMul =
            e.roundClosePrices.length > 0
              ? e.roundClosePrices[e.roundClosePrices.length - 1] /
                (e.startingPrice || 1)
              : 1;
          const exited = e.exitRound !== undefined;
          const label =
            exited && e.exitReason
              ? `R${e.exitRound} · ${EXIT_LABEL[e.exitReason].label}`
              : `×${lastMul.toFixed(2)}`;
          return (
            <div
              key={`${e.ownerId}-${e.startRound}`}
              className={`flex items-center gap-1.5 ${exited ? "opacity-70" : ""}`}
            >
              <span
                className="w-3 h-3 rounded-sm border border-cardEdge"
                style={{ backgroundColor: color }}
              />
              <span className="mascot">
                <SectorIcon sector={e.sector} size={16} />
              </span>
              <span className="truncate flex-1">
                {e.name}
                {e.ownerNickname !== e.name.replace(/\s*사$/, "") && (
                  <span className="text-neutral"> · {e.ownerNickname}</span>
                )}
              </span>
              <span
                className={`tabular-nums text-[10px] ${
                  exited
                    ? "text-danger"
                    : lastMul >= 1
                      ? "text-success"
                      : "text-danger"
                }`}
              >
                {exited ? "✕" : ""} {label}
              </span>
            </div>
          );
        })}
      </div>

      {/* 메인 라인 차트 */}
      <div className="rounded-element border border-cardEdge bg-paper overflow-hidden">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="block w-full h-auto"
        >
          {/* Y축 눈금 */}
          <g fontFamily="ui-monospace, monospace" fontSize="10" fill="#7A6A55">
            {[0.5, 1.0, 1.5, 2.0, 2.5].map((mul) => {
              if (mul > maxMul + 0.001 || mul < minMul - 0.001) return null;
              const y = yForMul(mul);
              return (
                <g key={mul}>
                  <line
                    x1={padLeft}
                    y1={y}
                    x2={W - padRight}
                    y2={y}
                    stroke="#D4C494"
                    strokeWidth="0.6"
                    strokeDasharray={mul === 1 ? "0" : "3 3"}
                    opacity={mul === 1 ? 0.8 : 0.4}
                  />
                  <text
                    x={padLeft - 4}
                    y={y + 3}
                    textAnchor="end"
                    fill={mul === 1 ? "#B58800" : "#7A6A55"}
                    fontWeight={mul === 1 ? 700 : 400}
                  >
                    ×{mul.toFixed(1)}
                  </text>
                </g>
              );
            })}
          </g>

          {/* X축 회차 라벨 */}
          <g fontFamily="ui-sans-serif" fontSize="10" fill="#7A6A55">
            {Array.from({ length: maxRounds }).map((_, i) => {
              const r = i + 1;
              const x = xForRound(r);
              return (
                <g key={r}>
                  <line
                    x1={x}
                    y1={padTop}
                    x2={x}
                    y2={H - padBottom}
                    stroke="#E8DDBE"
                    strokeWidth="0.5"
                  />
                  <text
                    x={x}
                    y={H - padBottom + 14}
                    textAnchor="middle"
                    fontWeight="700"
                  >
                    R{r}
                  </text>
                </g>
              );
            })}
          </g>

          {/* 회사별 라인 */}
          {history.map((e, i) => {
            const color = LINE_COLORS[i % LINE_COLORS.length];
            if (e.roundClosePrices.length === 0) return null;
            // 라인의 각 점: startRound 부터 시작
            const pts: string[] = [];
            // 첫 점은 시작가 (startRound 위치)
            pts.push(`${xForRound(e.startRound)},${yForMul(1)}`);
            for (let idx = 0; idx < e.roundClosePrices.length; idx++) {
              const r = e.startRound + idx;
              if (r > maxRounds) break;
              const mul = e.roundClosePrices[idx] / (e.startingPrice || 1);
              pts.push(`${xForRound(r)},${yForMul(mul)}`);
            }
            const exited = e.exitRound !== undefined;
            const lastPoint = pts[pts.length - 1].split(",");
            const lastX = parseFloat(lastPoint[0]);
            const lastY = parseFloat(lastPoint[1]);
            const finalMul =
              e.roundClosePrices[e.roundClosePrices.length - 1] /
              (e.startingPrice || 1);
            return (
              <g key={`line-${e.ownerId}-${e.startRound}`}>
                <polyline
                  points={pts.join(" ")}
                  fill="none"
                  stroke={color}
                  strokeWidth={exited ? 2 : 2.5}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  opacity={exited ? 0.7 : 1}
                />
                {/* 시작점 */}
                <circle
                  cx={xForRound(e.startRound)}
                  cy={yForMul(1)}
                  r="3"
                  fill={color}
                  stroke="white"
                  strokeWidth="1.5"
                />
                {/* 끝점: 살아있으면 큰 원 + 라벨, 엑시트면 X 마커 */}
                {exited ? (
                  <g transform={`translate(${lastX} ${lastY})`}>
                    <circle
                      r="8"
                      fill={color}
                      stroke="#3B2513"
                      strokeWidth="1.5"
                    />
                    <text
                      y="4"
                      textAnchor="middle"
                      fontSize="10"
                      fontWeight="900"
                      fill="white"
                    >
                      ✕
                    </text>
                  </g>
                ) : (
                  <>
                    <circle
                      cx={lastX}
                      cy={lastY}
                      r="5"
                      fill={color}
                      stroke="white"
                      strokeWidth="2"
                    />
                    <text
                      x={lastX + 8}
                      y={lastY + 4}
                      fontSize="10"
                      fontFamily="ui-monospace, monospace"
                      fontWeight="700"
                      fill={color}
                    >
                      ×{finalMul.toFixed(2)}
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      {/* 회차별 시장 심리 바 */}
      <div className="rounded-element border border-cardEdge bg-paper p-2">
        <div className="flex items-baseline justify-between mb-1">
          <p className="text-xs font-medium">📊 회차별 시장 심리</p>
          <p className="text-[10px] text-neutral">
            <span className="text-success">■</span> 호가 ·{" "}
            <span className="text-danger">■</span> 폭락 ·{" "}
            <span className="text-warning">🎢</span> R5 레버리지 ·{" "}
            <span className="text-danger">🌩️</span> R7 블랙스완
          </p>
        </div>
        <div className="flex items-end gap-1 h-16 border-b border-neutral/30 relative">
          {/* 중심선 */}
          <div className="absolute inset-x-0 top-1/2 border-t border-neutral/40" />
          {roundSentiment.map((s, i) => {
            const round = i + 1;
            const isLeverage = round === 5;
            const isBigEvent = round === 7;
            // 바 높이 (양수는 위, 음수는 아래).
            const magnitude = Math.min(0.5, Math.abs(s));
            const pctHeight = (magnitude / 0.5) * 50; // 최대 50%
            const isUp = s >= 0;
            const bg = isBigEvent
              ? "bg-danger"
              : isLeverage
                ? "bg-warning"
                : isUp
                  ? "bg-success/70"
                  : "bg-danger/70";
            return (
              <div
                key={round}
                className="flex-1 relative flex flex-col items-center justify-center h-full"
                title={`R${round} · ${(s * 100).toFixed(1)}%`}
              >
                {/* 위쪽 (양수) or 아래쪽 (음수) 바 */}
                {isUp ? (
                  <div
                    className={`w-full ${bg} rounded-t-sm absolute bottom-1/2`}
                    style={{ height: `${pctHeight}%` }}
                  />
                ) : (
                  <div
                    className={`w-full ${bg} rounded-b-sm absolute top-1/2`}
                    style={{ height: `${pctHeight}%` }}
                  />
                )}
                {/* 이벤트 아이콘 */}
                {isLeverage && (
                  <span className="absolute top-0 text-xs">🎢</span>
                )}
                {isBigEvent && (
                  <span className="absolute top-0 text-xs">🌩️</span>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex gap-1 mt-1">
          {roundSentiment.map((s, i) => (
            <div
              key={i}
              className="flex-1 text-center text-[9px] text-neutral tabular-nums"
            >
              R{i + 1}
              <br />
              <span
                className={
                  s > 0.02
                    ? "text-success font-medium"
                    : s < -0.02
                      ? "text-danger font-medium"
                      : ""
                }
              >
                {s >= 0 ? "+" : ""}
                {(s * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
