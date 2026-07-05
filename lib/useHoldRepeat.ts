import { useCallback, useEffect, useRef } from "react";

// 버튼을 꾹 누르면 반복 발동되는 훅.
// - 눌리는 순간 즉시 1회 발동
// - 그 다음 initialDelayMs 뒤부터 intervalMs 마다 반복
// - 뗄 때(마우스업/터치엔드/스크롤 이탈) 정지
// TRADE 페이즈 매수/매도 버튼 등에 사용.
export function useHoldRepeat(
  onFire: () => void,
  opts: { initialDelayMs?: number; intervalMs?: number } = {}
) {
  const { initialDelayMs = 400, intervalMs = 180 } = opts;
  const startTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fireRef = useRef(onFire);
  fireRef.current = onFire;

  const stop = useCallback(() => {
    if (startTimerRef.current) {
      clearTimeout(startTimerRef.current);
      startTimerRef.current = null;
    }
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    stop();
    fireRef.current(); // 즉시 1회
    startTimerRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => fireRef.current(), intervalMs);
    }, initialDelayMs);
  }, [stop, initialDelayMs, intervalMs]);

  useEffect(() => stop, [stop]);

  return {
    onPointerDown: start,
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onContextMenu: (e: React.SyntheticEvent) => e.preventDefault(),
  };
}
