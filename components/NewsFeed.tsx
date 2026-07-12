"use client";

import { useEffect, useMemo, useState } from "react";
import { useGameStore } from "@/lib/store";

// 우측 상단 뉴스 팝업 스택.
// 서버 state.newsEvents 를 감시해서 새로운 이벤트가 오면 팝업으로 띄운다.
// 각 카드는 6초 후 자동 dismiss. 새 카드는 위에서 슬라이드 인, 기존 카드는 아래로 밀림.

const DISMISS_MS = 6000;
const MAX_VISIBLE = 4;

export default function NewsFeed() {
  const news = useGameStore((s) => s.state?.newsEvents ?? []);
  // 화면에 살아있는 카드 id 집합. 서버가 새 이벤트를 보내면 여기에 추가되고 타이머로 제거됨.
  const [visible, setVisible] = useState<number[]>([]);
  const [seen, setSeen] = useState<Set<number>>(new Set());

  useEffect(() => {
    // 새 이벤트 감지 → 화면에 추가 + 타이머
    // spotlight 이벤트는 큰 오버레이(SpotlightModal)로만 표시하고 이 스택에선 제외.
    for (const n of news) {
      if (n.spotlight) {
        seen.add(n.id); // 나중에 spotlight 해제돼도 재등장 안 하게 seen 기록
        continue;
      }
      if (!seen.has(n.id)) {
        seen.add(n.id);
        setSeen(new Set(seen));
        setVisible((v) => [n.id, ...v].slice(0, MAX_VISIBLE));
        setTimeout(() => {
          setVisible((v) => v.filter((x) => x !== n.id));
        }, DISMISS_MS);
      }
    }
  }, [news, seen]);

  const visibleNews = useMemo(() => {
    const byId = new Map(news.map((n) => [n.id, n]));
    return visible
      .map((id) => byId.get(id))
      .filter((n): n is NonNullable<typeof n> => !!n);
  }, [visible, news]);

  if (visibleNews.length === 0) return null;

  return (
    <div
      className="fixed right-3 top-3 z-40 flex flex-col gap-2 pointer-events-none"
      style={{ maxWidth: "min(92vw, 320px)" }}
      aria-live="polite"
    >
      {visibleNews.map((n) => {
        const tone =
          n.tone === "good"
            ? "border-success bg-success/10"
            : n.tone === "bad"
              ? "border-danger bg-danger/10"
              : "border-cardEdge bg-card";
        return (
          <div
            key={n.id}
            className={`news-card rounded-card border-2 ${tone} p-3 shadow-md pointer-events-auto`}
          >
            <div className="flex items-baseline gap-2">
              <span className="text-lg leading-none">{n.emoji}</span>
              <div className="flex-1">
                <p className="text-sm font-medium">{n.headline}</p>
                {n.detail && (
                  <p className="text-xs text-neutral mt-0.5">{n.detail}</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <style jsx>{`
        .news-card {
          animation: news-slide-in 320ms ease-out;
        }
        @keyframes news-slide-in {
          from {
            transform: translateY(-16px);
            opacity: 0;
          }
          to {
            transform: translateY(0);
            opacity: 1;
          }
        }
      `}</style>
    </div>
  );
}
