"use client";

import { useCallback, useEffect, useRef } from "react";

// 눌렀을 때 1회 실행 + 꾹 누르면 일정 간격으로 반복 실행하는 버튼.
// 마우스/터치 모두 지원. disabled 되면 즉시 반복 중단.
// - initialDelay: 첫 반복 시작까지의 딜레이 (기본 320ms)
// - interval: 반복 간격 (기본 90ms). 시간이 지날수록 accelerate 옵션으로 가속 가능
// - accelerate: true 면 반복이 계속될수록 interval 감소 (최소 40ms)
interface Props {
  onStep: () => void;
  disabled?: boolean;
  className?: string;
  children?: React.ReactNode;
  initialDelay?: number;
  interval?: number;
  accelerate?: boolean;
  "aria-label"?: string;
}

export default function HoldRepeatButton({
  onStep,
  disabled,
  className,
  children,
  initialDelay = 320,
  interval = 90,
  accelerate = true,
  "aria-label": ariaLabel,
}: Props) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeRef = useRef(false);
  const stepRef = useRef(onStep);

  useEffect(() => {
    stepRef.current = onStep;
  }, [onStep]);

  const stop = useCallback(() => {
    activeRef.current = false;
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (disabled) stop();
  }, [disabled, stop]);

  useEffect(() => stop, [stop]);

  const start = useCallback(() => {
    if (disabled || activeRef.current) return;
    activeRef.current = true;
    // 즉시 1회 실행 (탭/클릭 반응성)
    stepRef.current();
    let currentInterval = interval;
    const tick = () => {
      if (!activeRef.current || disabled) return;
      stepRef.current();
      if (accelerate && currentInterval > 40) {
        currentInterval = Math.max(40, currentInterval - 8);
      }
      timeoutRef.current = setTimeout(tick, currentInterval);
    };
    timeoutRef.current = setTimeout(tick, initialDelay);
  }, [disabled, initialDelay, interval, accelerate]);

  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      className={className}
      onPointerDown={(e) => {
        e.preventDefault();
        start();
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}
