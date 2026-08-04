"use client";

import { useState } from "react";
import type { Avatar as AvatarData, AvatarEmotion } from "@/game/types";
import {
  AVATAR_EMOTIONS,
  AVATAR_EMOTION_LABEL,
  AVATAR_FACE_COUNT,
  AVATAR_SKIN_TONES,
} from "@/game/types";
import Avatar from "./Avatar";
import DrawPad from "./DrawPad";

// 아바타 편집기: 4탭 (얼굴/피부/표정/그리기) + 큰 프리뷰.
// 변경 즉시 onChange 호출. 손그림은 pad 에서 "사용" 눌러야 반영.
type Tab = "face" | "skin" | "emotion" | "draw";

interface Props {
  value: AvatarData;
  onChange: (a: AvatarData) => void;
  previewSize?: number;
}

const TABS: { key: Tab; label: string; icon: string }[] = [
  { key: "face", label: "얼굴", icon: "👤" },
  { key: "skin", label: "피부색", icon: "🎨" },
  { key: "emotion", label: "표정", icon: "😊" },
  { key: "draw", label: "그리기", icon: "✏️" },
];

export default function AvatarEditor({
  value,
  onChange,
  previewSize = 96,
}: Props) {
  const [tab, setTab] = useState<Tab>("face");
  const hasDrawing = !!value.drawingDataUrl;

  function patch(next: Partial<AvatarData>) {
    // 얼굴/피부/표정 편집 시 손그림 자동 해제 (겹치지 않게).
    const cleared: AvatarData = {
      face: value.face,
      skin: value.skin,
      emotion: value.emotion,
      ...next,
    };
    onChange(cleared);
  }

  return (
    <div className="rounded-card border-2 border-cardEdge bg-card p-3 flex flex-col gap-3">
      {/* 프리뷰 */}
      <div className="flex items-center gap-3">
        <div
          className="rounded-full border-2 border-cardEdge bg-paper flex items-center justify-center overflow-hidden"
          style={{ width: previewSize, height: previewSize, flexShrink: 0 }}
        >
          <Avatar avatar={value} size={previewSize - 8} />
        </div>
        <div className="text-xs text-neutral">
          <p className="text-sm font-medium text-ink">내 캐릭터</p>
          <p>
            {hasDrawing
              ? "✏️ 손그림 사용중"
              : `얼굴 ${(value.face ?? 0) + 1} · ${AVATAR_EMOTION_LABEL[value.emotion ?? "neutral"]}`}
          </p>
          {hasDrawing && (
            <button
              type="button"
              onClick={() =>
                onChange({
                  face: value.face,
                  skin: value.skin,
                  emotion: value.emotion,
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
      {tab === "face" && (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: AVATAR_FACE_COUNT }).map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => patch({ face: i })}
              className={`rounded-element border-2 p-2 flex items-center justify-center ${
                (value.face ?? 0) === i && !hasDrawing
                  ? "border-warning bg-accentSoft"
                  : "border-cardEdge bg-paper"
              }`}
              aria-label={`얼굴 ${i + 1}`}
            >
              <Avatar
                avatar={{
                  face: i,
                  skin: value.skin,
                  emotion: value.emotion,
                }}
                size={44}
              />
            </button>
          ))}
        </div>
      )}

      {tab === "skin" && (
        <div className="flex flex-col gap-2">
          <div className="grid grid-cols-6 gap-2">
            {AVATAR_SKIN_TONES.map((tone) => (
              <button
                key={tone}
                type="button"
                onClick={() => patch({ skin: tone })}
                aria-label={`피부색 ${tone}`}
                style={{ backgroundColor: tone }}
                className={`w-full aspect-square rounded-full border-2 ${
                  value.skin === tone
                    ? "border-warning ring-2 ring-warning"
                    : "border-cardEdge"
                }`}
              />
            ))}
          </div>
          <p className="text-[10px] text-neutral text-center">
            프리셋 6종 · 자기 개성에 맞게
          </p>
        </div>
      )}

      {tab === "emotion" && (
        <div className="grid grid-cols-5 gap-2">
          {AVATAR_EMOTIONS.map((em) => (
            <button
              key={em}
              type="button"
              onClick={() => patch({ emotion: em })}
              className={`rounded-element border-2 p-1 flex flex-col items-center gap-1 ${
                (value.emotion ?? "neutral") === em && !hasDrawing
                  ? "border-warning bg-accentSoft"
                  : "border-cardEdge bg-paper"
              }`}
            >
              <Avatar
                avatar={{
                  face: value.face,
                  skin: value.skin,
                  emotion: em,
                }}
                size={36}
              />
              <span className="text-[10px]">{AVATAR_EMOTION_LABEL[em]}</span>
            </button>
          ))}
        </div>
      )}

      {tab === "draw" && (
        <DrawPad
          initial={value.drawingDataUrl}
          onCommit={(dataUrl) =>
            onChange({
              face: value.face,
              skin: value.skin,
              emotion: value.emotion,
              drawingDataUrl: dataUrl,
            })
          }
        />
      )}
    </div>
  );
}
