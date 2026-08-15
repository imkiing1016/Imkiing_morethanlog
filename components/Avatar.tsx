"use client";

import { useEffect, useState } from "react";
import type { Avatar as AvatarData } from "@/game/types";
import { ANIMAL_LIST, ORNAMENT_LIST } from "@/game/types";

// 아바타 렌더러 — 20종 동물 프리셋 + 장식 + 배경색 or 손그림.
// 손그림 최우선. 다음 우선순위:
//   1) public/animals/sheet.png 존재 → 5×4 스프라이트 시트에서 해당 셀만 렌더
//   2) 없으면 이모지 폴백 (기본 배포된 상태)
// bg color 는 시트 밑에 깔리므로 시트는 배경 투명 PNG 권장.
interface Props {
  avatar?: AvatarData;
  size?: number;
  className?: string;
  fallback?: React.ReactNode;
}

const DEFAULT_BG = "#FFF6E0";
const SHEET_URL = "/animals/sheet.webp";
const SHEET_COLS = 5;
const SHEET_ROWS = 4;

// 시트 로딩 상태를 모듈 스코프에서 캐시 — 매 컴포넌트 마운트마다 재-probe 방지.
// null=미확인, true=있음, false=404.
let sheetChecked: boolean | null = null;
const sheetListeners = new Set<(v: boolean) => void>();

function useSheetAvailable(): boolean {
  const [ok, setOk] = useState<boolean>(sheetChecked === true);

  useEffect(() => {
    if (sheetChecked !== null) {
      setOk(sheetChecked);
      return;
    }
    if (typeof window === "undefined") return;
    const img = new window.Image();
    const listener = (v: boolean) => setOk(v);
    sheetListeners.add(listener);
    img.onload = () => {
      sheetChecked = true;
      sheetListeners.forEach((l) => l(true));
    };
    img.onerror = () => {
      sheetChecked = false;
      sheetListeners.forEach((l) => l(false));
    };
    img.src = SHEET_URL;
    return () => {
      sheetListeners.delete(listener);
    };
  }, []);

  return ok;
}

// 조회 최적화용.
const ANIMAL_INDEX = new Map(ANIMAL_LIST.map((a, i) => [a.id, i]));
const ANIMAL_MAP = new Map(ANIMAL_LIST.map((a) => [a.id, a]));
const ORNAMENT_MAP = new Map(ORNAMENT_LIST.map((o) => [o.id, o]));

export default function Avatar({
  avatar,
  size = 40,
  className,
  fallback,
}: Props) {
  const sheetOk = useSheetAvailable();

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
          flexShrink: 0,
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

  // 이모지 폴백 크기 = 원형 지름의 ~62%
  const emojiSize = Math.max(12, Math.round(size * 0.62));
  // 장식 = 지름의 ~32%, 우측 상단
  const ornSize = Math.max(8, Math.round(size * 0.32));

  // 스프라이트 좌표 계산 (5×4 그리드).
  const idx = ANIMAL_INDEX.get(animal.id) ?? 0;
  const col = idx % SHEET_COLS;
  const row = Math.floor(idx / SHEET_COLS);
  const bgX = SHEET_COLS > 1 ? (col / (SHEET_COLS - 1)) * 100 : 0;
  const bgY = SHEET_ROWS > 1 ? (row / (SHEET_ROWS - 1)) * 100 : 0;

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
      role="img"
      aria-label={animal.label}
    >
      {sheetOk ? (
        // 스프라이트 시트 슬라이스
        <span
          aria-hidden="true"
          style={{
            width: "88%",
            height: "88%",
            backgroundImage: `url(${SHEET_URL})`,
            backgroundSize: `${SHEET_COLS * 100}% ${SHEET_ROWS * 100}%`,
            backgroundPosition: `${bgX}% ${bgY}%`,
            backgroundRepeat: "no-repeat",
          }}
        />
      ) : (
        // 이모지 폴백 (시트 파일 없으면 자동)
        <span
          aria-hidden="true"
          style={{
            fontSize: emojiSize,
            lineHeight: 1,
            userSelect: "none",
          }}
        >
          {animal.emoji}
        </span>
      )}
      {ornament && ornament.emoji && (
        <span
          aria-hidden="true"
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
