"use client";

import { useState } from "react";
import type { Avatar as AvatarData } from "@/game/types";
import {
  ANIMAL_LIST,
  AVATAR_BG_COLORS,
  ORNAMENT_LIST,
} from "@/game/types";
import Avatar from "./Avatar";
import DrawPad from "./DrawPad";

// 아바타 편집기: 3탭 (동물/꾸미기/그리기) + 큰 프리뷰.
// - 동물: 20종 프리셋 중 선택
// - 꾸미기: 우측 상단 장식 뱃지 + 원형 배경색
// - 그리기: 자유 손그림 (있으면 프리셋 무시하고 우선 렌더)
// 프리셋 편집 시 손그림 자동 해제. "프리셋으로 되돌리기" 로 언제든 복귀.
type Tab = "animal" | "decor" | "draw";

interface Props {
  value: AvatarData;
  onChange: (a: AvatarData) => void;
  previewSize?: number;
}

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "animal", label: "동물", icon: "🐰" },
  { key: "decor", label: "꾸미기", icon: "✨" },
  { key: "draw", label: "그리기", icon: "✏️" },
];

const ANIMAL_MAP = new Map(ANIMAL_LIST.map((a) => [a.id, a]));
const ORNAMENT_MAP = new Map(ORNAMENT_LIST.map((o) => [o.id, o]));

export default function AvatarEditor({
  value,
  onChange,
  previewSize = 96,
}: Props) {
  const [tab, setTab] = useState<Tab>("animal");
  const hasDrawing = !!value.drawingDataUrl;
  const animal = value.animalId ? ANIMAL_MAP.get(value.animalId) : undefined;
  const ornament = value.ornamentId
    ? ORNAMENT_MAP.get(value.ornamentId)
    : undefined;

  // 프리셋 편집 시 손그림은 자동 해제.
  function patch(next: Partial<AvatarData>) {
    onChange({
      animalId: value.animalId,
      ornamentId: value.ornamentId,
      bgColor: value.bgColor,
      ...next,
      drawingDataUrl: undefined,
    });
  }

  return (
    <div className="rounded-card border-2 border-cardEdge bg-card p-3 flex flex-col gap-3">
      {/* 프리뷰 */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center justify-center"
          style={{ width: previewSize, height: previewSize, flexShrink: 0 }}
        >
          <Avatar
            avatar={value}
            size={previewSize}
            fallback={
              <span className="text-neutral text-3xl">👤</span>
            }
          />
        </div>
        <div className="text-xs text-neutral flex-1 min-w-0">
          <p className="text-sm font-medium text-ink">내 캐릭터</p>
          <p className="truncate">
            {hasDrawing
              ? "✏️ 손그림 사용중"
              : animal
                ? `${animal.emoji} ${animal.label}${ornament && ornament.emoji ? ` · ${ornament.label}` : ""}`
                : "동물을 골라주세요"}
          </p>
          {hasDrawing && (
            <button
              type="button"
              onClick={() =>
                onChange({
                  animalId: value.animalId,
                  ornamentId: value.ornamentId,
                  bgColor: value.bgColor,
                  drawingDataUrl: undefined,
                })
              }
              className="mt-1 text-[10px] px-2 py-0.5 rounded-element border border-cardEdge bg-paper"
            >
              프리셋으로 되돌리기
            </button>
          )}
        </div>
      </div>

      {/* 탭 */}
      <div className="flex gap-1 border-b border-cardEdge">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`flex-1 px-2 py-1.5 text-xs font-medium border-b-2 -mb-px ${
              tab === t.key
                ? "border-warning text-warning"
                : "border-transparent text-neutral"
            }`}
          >
            <span className="mr-1">{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* 탭 컨텐츠 */}
      {tab === "animal" && (
        <div className="grid grid-cols-5 gap-2">
          {ANIMAL_LIST.map((a) => {
            const picked = value.animalId === a.id && !hasDrawing;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => patch({ animalId: a.id })}
                className={`rounded-element border-2 p-1.5 flex flex-col items-center gap-0.5 ${
                  picked
                    ? "border-warning bg-accentSoft"
                    : "border-cardEdge bg-paper"
                }`}
                aria-label={a.label}
                title={a.label}
              >
                <Avatar
                  avatar={{
                    animalId: a.id,
                    bgColor: value.bgColor,
                  }}
                  size={40}
                />
                <span className="text-[9px] text-neutral leading-tight truncate max-w-full">
                  {a.label}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {tab === "decor" && (
        <div className="flex flex-col gap-3">
          {/* 장식 */}
          <div>
            <p className="text-xs text-neutral mb-1.5">✨ 장식 (우측 상단 뱃지)</p>
            <div className="grid grid-cols-6 gap-2">
              {ORNAMENT_LIST.map((o) => {
                const picked =
                  (value.ornamentId ?? "none") === o.id && !hasDrawing;
                return (
                  <button
                    key={o.id}
                    type="button"
                    onClick={() => patch({ ornamentId: o.id })}
                    className={`rounded-element border-2 aspect-square flex flex-col items-center justify-center ${
                      picked
                        ? "border-warning bg-accentSoft"
                        : "border-cardEdge bg-paper"
                    }`}
                    aria-label={o.label}
                    title={o.label}
                  >
                    <span className="text-xl leading-none">
                      {o.emoji || "∅"}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          {/* 배경색 */}
          <div>
            <p className="text-xs text-neutral mb-1.5">🎨 원형 배경색</p>
            <div className="grid grid-cols-6 gap-2">
              {AVATAR_BG_COLORS.map((bg) => {
                const picked = value.bgColor === bg.hex && !hasDrawing;
                return (
                  <button
                    key={bg.id}
                    type="button"
                    onClick={() => patch({ bgColor: bg.hex })}
                    aria-label={`배경 ${bg.label}`}
                    title={bg.label}
                    style={{ backgroundColor: bg.hex }}
                    className={`w-full aspect-square rounded-full border-2 ${
                      picked
                        ? "border-warning ring-2 ring-warning"
                        : "border-cardEdge"
                    }`}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {tab === "draw" && (
        <DrawPad
          initial={value.drawingDataUrl}
          onCommit={(dataUrl) =>
            onChange({
              animalId: value.animalId,
              ornamentId: value.ornamentId,
              bgColor: value.bgColor,
              drawingDataUrl: dataUrl,
            })
          }
        />
      )}
    </div>
  );
}
