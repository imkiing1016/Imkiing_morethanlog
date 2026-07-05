"use client";

import { useDebugLog } from "@/lib/debugLog";

// 디버그 패널: 우측 하단 플로팅 버튼으로 토글.
// 모든 send()/snapshot/status 이벤트를 시간순으로 표시한다.
export default function DebugPanel() {
  const entries = useDebugLog((s) => s.entries);
  const open = useDebugLog((s) => s.open);
  const setOpen = useDebugLog((s) => s.setOpen);
  const clear = useDebugLog((s) => s.clear);

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
