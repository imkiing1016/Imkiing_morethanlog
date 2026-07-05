"use client";

import { useHoldRepeat } from "@/lib/useHoldRepeat";

// 꾹 눌러서 반복 실행되는 버튼.
// onFire 는 매 발동마다 호출됨. disabled 면 아무것도 안 함.
export default function HoldButton({
  onFire,
  disabled,
  children,
  className,
}: {
  onFire: () => void;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
}) {
  const handlers = useHoldRepeat(() => {
    if (!disabled) onFire();
  });
  return (
    <button
      type="button"
      disabled={disabled}
      className={className}
      // 눌리는 동안 텍스트 선택 방지 (모바일 롱프레스 대응)
      style={{ touchAction: "manipulation", userSelect: "none" }}
      {...(disabled ? {} : handlers)}
    >
      {children}
    </button>
  );
}
