"use client";

import type { Avatar as AvatarData } from "@/game/types";
import { ANIMAL_LIST, AVATAR_BG_COLORS, ORNAMENT_LIST } from "@/game/types";

// 아바타 렌더러 — 20종 동물 프리셋 + 장식 + 배경색 or 손그림.
// 손그림이 있으면 우선. 아니면 원형 배경 + 동물 이모지 + 장식 뱃지.
interface Props {
  avatar?: AvatarData;
  size?: number;
  className?: string;
  fallback?: React.ReactNode;
}

const DEFAULT_BG = "#FFF6E0";
const ANIMAL_MAP = new Map(ANIMAL_LIST.map((a) => [a.id, a]));
const ORNAMENT_MAP = new Map(ORNAMENT_LIST.map((o) => [o.id, o]));

export default function Avatar({
  avatar,
  size = 40,
  className,
  fallback,
}: Props) {
  // 손그림 우선
  if (avatar?.drawingDataUrl) {
    return (
      <img
        src={avatar.drawingDataUrl}
        alt="플레이어 손그림"
        width={size}
        height={size}
        className={className}
        style={{
          width: size,
          height: size,
          borderRadius: "50%",
          objectFit: "cover",
          border: "1.5px solid #3B2513",
          background: "#fff",
        }}
      />
    );
  }

  const animal = avatar?.animalId
    ? ANIMAL_MAP.get(avatar.animalId)
    : undefined;
  const ornament = avatar?.ornamentId
    ? ORNAMENT_MAP.get(avatar.ornamentId)
    : undefined;
  const bg = avatar?.bgColor ?? DEFAULT_BG;

  if (!animal) {
    return <>{fallback ?? null}</>;
  }

  // 이모지 크기 = 원형 지름의 65%
  const emojiSize = Math.max(12, Math.round(size * 0.62));
  // 장식 = 지름의 32%, 우측 상단
  const ornSize = Math.max(8, Math.round(size * 0.32));

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        position: "relative",
        width: size,
        height: size,
        borderRadius: "50%",
        background: bg,
        border: `${Math.max(1, Math.round(size * 0.045))}px solid #234533`,
        alignItems: "center",
        justifyContent: "center",
        overflow: "visible",
        boxSizing: "border-box",
        flexShrink: 0,
      }}
      aria-hidden="true"
    >
      <span
        style={{
          fontSize: emojiSize,
          lineHeight: 1,
          userSelect: "none",
        }}
      >
        {animal.emoji}
      </span>
      {ornament && ornament.emoji && (
        <span
          style={{
            position: "absolute",
            top: `-${Math.round(size * 0.08)}px`,
            right: `-${Math.round(size * 0.08)}px`,
            fontSize: ornSize,
            lineHeight: 1,
            filter: "drop-shadow(0 1px 1px rgba(0,0,0,.25))",
          }}
        >
          {ornament.emoji}
        </span>
      )}
    </span>
  );
}
