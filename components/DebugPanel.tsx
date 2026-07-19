"use client";

import { useEffect, useState } from "react";
import { useDebugLog } from "@/lib/debugLog";

// 디버그 패널: 우측 하단 플로팅 버튼으로 토글.
// 모든 send()/snapshot/status 이벤트를 시간순으로 표시한다.
// URL 파라미터 ?debug=1 로 진입한 사용자에게만 노출 (일반 유저는 아이콘조차 안 보임).
// 세션 스토리지에 저장해 방 페이지로 이동해도 유지. 백업 토글: Ctrl+Shift+D.
export default function DebugPanel() {
  const [enabled, setEnabled] = useState(false);
  const entries = useDebugLog((s) => s.entries);
  const open = useDebugLog((s) => s.open);
  const setOpen = useDebugLog((s) => s.setOpen);
  const clear = useDebugLog((s) => s.clear);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("debug") === "1") {
      sessionStorage.setItem("_debugEnabled", "1");
      setEnabled(true);
    } else if (sessionStorage.getItem("_debugEnabled") === "1") {
      setEnabled(true);
    }
    // 백업 토글: Ctrl+Shift+D (URL 붙이기 잊었을 때).
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && (e.key === "D" || e.key === "d")) {
        e.preventDefault();
        setEnabled((prev) => {
          const next = !prev;
          if (next) sessionStorage.setItem("_debugEnabled", "1");
          else sessionStorage.removeItem("_debugEnabled");
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!enabled) return null;

  return (
    <div
      className="fixed right-3 bottom-3 z-50 flex flex-col items-end gap-2"
      style={{ maxWidth: "calc(100vw - 24px)" }}
    >
      {open && (
        <div className="w-[min(94vw,420px)] max-h-[60vh] bg-card border-2 border-cardEdge rounded-card shadow-lg flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-cardEdge bg-paper">
            <span className="text-sm font-medium">🐞 디버그 로그 ({entries.length})</span>
            <div className="flex gap-2">
              <button
                onClick={clear}
                className="text-xs px-2 py-1 rounded-element border border-cardEdge"
              >
                지우기
              </button>
              <button
                onClick={() => setOpen(false)}
                className="text-xs px-2 py-1 rounded-element border border-cardEdge"
              >
                닫기
              </button>
            </div>
          </div>
          <ul className="flex-1 overflow-auto text-xs">
            {entries.length === 0 && (
              <li className="p-3 text-neutral">아직 로그가 없어요. 버튼을 눌러보세요.</li>
            )}
            {entries
              .slice()
              .reverse()
              .map((e) => {
                const t = new Date(e.timestamp);
                const time = `${t.getMinutes().toString().padStart(2, "0")}:${t
                  .getSeconds()
                  .toString()
                  .padStart(2, "0")}`;
                const color =
                  e.kind === "send"
                    ? "text-warning"
                    : e.kind === "recv"
                      ? "text-info"
                      : e.kind === "error"
                        ? "text-danger"
                        : e.kind === "status"
                          ? "text-success"
                          : "text-neutral";
                return (
                  <li
                    key={e.id}
                    className="px-3 py-1.5 border-b border-cardEdge/50 flex flex-col gap-0.5"
                  >
                    <div className="flex gap-2 items-baseline">
                      <span className="text-neutral tabular-nums">{time}</span>
                      <span className={color}>{e.text}</span>
                    </div>
                    {e.detail && (
                      <div className="text-neutral font-mono break-all pl-9">
                        {e.detail}
                      </div>
                    )}
                  </li>
                );
              })}
          </ul>
        </div>
      )}

      <button
        onClick={() => setOpen(!open)}
        className="rounded-full bg-ink text-paper w-12 h-12 shadow-md text-xl border-2 border-cardEdge"
        aria-label="디버그 로그 토글"
      >
        🐞
      </button>
    </div>
  );
}
