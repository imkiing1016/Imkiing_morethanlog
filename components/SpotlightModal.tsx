"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useGameStore } from "@/lib/store";

// 큰 오버레이 모달: 회사 매각 성사 / 부활 IPO 등 임팩트 순간을
// 전 플레이어 화면 중앙에 3.5초간 크게 띄운다.
// - 서버 newsEvents 중 spotlight:true 인 항목만 감지.
// - 큐로 처리해 여러 매각이 연속으로 터져도 순서대로 하나씩 노출.
// - 각 카드는 tone 별로 색·이모지 이펙트가 다름 (celebration/hostile/somber/rebirth).

const SPOTLIGHT_MS = 3500;

type Spotlight = {
  id: number;
  emoji: string;
  headline: string;
  detail?: string;
  flavorQuote?: string;
  tone: "celebration" | "hostile" | "somber" | "rebirth";
};

export default function SpotlightModal() {
  const news = useGameStore((s) => s.state?.newsEvents ?? []);
  const seenRef = useRef<Set<number>>(new Set());
  const [queue, setQueue] = useState<Spotlight[]>([]);
  const [now, setNow] = useState<Spotlight | null>(null);

  // 새 spotlight 이벤트 감지 → 큐에 추가
  useEffect(() => {
    for (const n of news) {
      if (!n.spotlight) continue;
      if (seenRef.current.has(n.id)) continue;
      seenRef.current.add(n.id);
      const item: Spotlight = {
        id: n.id,
        emoji: n.emoji,
        headline: n.headline,
        detail: n.detail,
        flavorQuote: n.flavorQuote,
        tone: n.spotlightTone ?? "celebration",
      };
      setQueue((q) => [...q, item]);
    }
  }, [news]);

  // 큐 → 표시 회전
  useEffect(() => {
    if (now || queue.length === 0) return;
    setNow(queue[0]);
    setQueue((q) => q.slice(1));
    const t = setTimeout(() => setNow(null), SPOTLIGHT_MS);
    return () => clearTimeout(t);
  }, [queue, now]);

  const styles = useMemo(() => {
    if (!now)
      return {
        border: "border-cardEdge",
        bg: "bg-card",
        accent: "text-neutral",
        confetti: [] as string[],
      };
    switch (now.tone) {
      case "celebration":
        return {
          border: "border-success",
          bg: "bg-gradient-to-br from-success/25 via-card to-warning/20",
          accent: "text-success",
          confetti: ["🎉", "✨", "💰", "🥂", "⭐"],
        };
      case "hostile":
        return {
          border: "border-danger",
          bg: "bg-gradient-to-br from-danger/30 via-card to-black/40",
          accent: "text-danger",
          confetti: ["⚠️", "🩸", "💢", "🔻", "🖤"],
        };
      case "somber":
        return {
          border: "border-cardEdge",
          bg: "bg-gradient-to-br from-neutral/20 via-card to-cardEdge/40",
          accent: "text-neutral",
          confetti: ["🏛️", "📜", "🕊️"],
        };
      case "rebirth":
        return {
          border: "border-warning",
          bg: "bg-gradient-to-br from-warning/25 via-card to-success/25",
          accent: "text-warning",
          confetti: ["🚀", "✨", "🌱", "🔥", "⭐"],
        };
    }
  }, [now]);

  if (!now) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 pointer-events-none"
      aria-live="assertive"
    >
      {/* 배경 오버레이 (클릭으로 즉시 dismiss) */}
      <div
        className="absolute inset-0 bg-black/40 spotlight-fade pointer-events-auto"
        onClick={() => setNow(null)}
      />

      {/* 컨페티 이모지 (배경) */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {styles.confetti.map((c, i) => (
          <span
            key={i}
            className="absolute text-4xl opacity-70 confetti"
            style={{
              left: `${(i * 17 + 8) % 90}%`,
              animationDelay: `${i * 120}ms`,
              animationDuration: `${1800 + (i % 3) * 400}ms`,
            }}
          >
            {c}
          </span>
        ))}
      </div>

      {/* 본체 카드 */}
      <div
        className={`relative w-full max-w-md rounded-card border-4 ${styles.border} ${styles.bg} p-6 shadow-2xl spotlight-pop pointer-events-auto`}
        onClick={() => setNow(null)}
      >
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="text-6xl leading-none spotlight-emoji">
            {now.emoji}
          </span>
          <p className={`text-xl font-bold ${styles.accent}`}>
            {now.headline}
          </p>
          {now.detail && (
            <p className="text-sm text-neutral leading-snug">{now.detail}</p>
          )}
          {now.flavorQuote && (
            <p className="text-base italic text-ink/90 mt-1 leading-snug">
              “{now.flavorQuote}”
            </p>
          )}
          <p className="text-xs text-neutral mt-2">화면을 눌러 넘기기</p>
        </div>
      </div>

      <style jsx>{`
        .spotlight-fade {
          animation: spotlight-fade-in 200ms ease-out;
        }
        .spotlight-pop {
          animation: spotlight-pop 380ms cubic-bezier(0.2, 1.3, 0.4, 1);
        }
        .spotlight-emoji {
          animation: spotlight-emoji-bounce 900ms ease-out infinite;
          display: inline-block;
        }
        .confetti {
          top: -10%;
          animation-name: spotlight-confetti;
          animation-timing-function: linear;
          animation-iteration-count: infinite;
        }
        @keyframes spotlight-fade-in {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes spotlight-pop {
          from {
            transform: scale(0.6) rotate(-3deg);
            opacity: 0;
          }
          60% {
            transform: scale(1.05) rotate(1deg);
            opacity: 1;
          }
          to {
            transform: scale(1) rotate(0);
            opacity: 1;
          }
        }
        @keyframes spotlight-emoji-bounce {
          0%,
          100% {
            transform: translateY(0) scale(1);
          }
          50% {
            transform: translateY(-10px) scale(1.1);
          }
        }
        @keyframes spotlight-confetti {
          0% {
            transform: translateY(0) rotate(0);
            opacity: 0;
          }
          10% {
            opacity: 1;
          }
          100% {
            transform: translateY(110vh) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
