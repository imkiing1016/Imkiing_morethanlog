"use client";

import type { Avatar as AvatarData, AvatarEmotion } from "@/game/types";

// 아바타 SVG 렌더러 — 프리셋(얼굴/피부/표정) 또는 손그림(base64 PNG) 표시.
// size 는 렌더 픽셀 크기. 부모에서 원하는 크기로 지정.
interface Props {
  avatar?: AvatarData;
  size?: number;
  className?: string;
  fallback?: React.ReactNode;
}

const DEFAULT_SKIN = "#FCD9B8";

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
          borderRadius: 8,
          objectFit: "cover",
          imageRendering: "auto",
        }}
      />
    );
  }
  // 프리셋 아바타가 하나라도 지정되면 SVG 렌더
  if (
    avatar &&
    (avatar.face !== undefined ||
      avatar.skin !== undefined ||
      avatar.emotion !== undefined)
  ) {
    return (
      <PresetAvatarSvg
        face={avatar.face ?? 0}
        skin={avatar.skin ?? DEFAULT_SKIN}
        emotion={avatar.emotion ?? "neutral"}
        size={size}
        className={className}
      />
    );
  }
  // 아무 것도 없음 → fallback
  return <>{fallback ?? null}</>;
}

// 얼굴 형태 6종 (헤드 SVG path).
// viewBox 100×100 기준. 중앙 정렬.
function FaceShape({ face, fill }: { face: number; fill: string }) {
  const stroke = "#3B2513";
  const sw = 2.5;
  switch (face % 6) {
    case 0: // 계란형
      return (
        <ellipse cx="50" cy="52" rx="30" ry="36" fill={fill} stroke={stroke} strokeWidth={sw} />
      );
    case 1: // 원형
      return (
        <circle cx="50" cy="52" r="34" fill={fill} stroke={stroke} strokeWidth={sw} />
      );
    case 2: // 사각(둥근)
      return (
        <rect
          x="18"
          y="18"
          width="64"
          height="66"
          rx="18"
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
        />
      );
    case 3: // 볼통볼통 (넓은 얼굴)
      return (
        <path
          d="M50 12 C74 12 82 34 82 52 C82 78 66 88 50 88 C34 88 18 78 18 52 C18 34 26 12 50 12 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
        />
      );
    case 4: // 뾰족한 턱
      return (
        <path
          d="M50 14 C72 14 80 32 80 48 C80 66 66 92 50 92 C34 92 20 66 20 48 C20 32 28 14 50 14 Z"
          fill={fill}
          stroke={stroke}
          strokeWidth={sw}
        />
      );
    case 5: // 세로 긴 계란
      return (
        <ellipse cx="50" cy="50" rx="26" ry="40" fill={fill} stroke={stroke} strokeWidth={sw} />
      );
    default:
      return null;
  }
}

// 감정별 눈/입 오버레이.
function Emotion({ emotion }: { emotion: AvatarEmotion }) {
  const stroke = "#1A1108";
  const sw = 2.5;
  const eyes: Record<AvatarEmotion, React.ReactNode> = {
    neutral: (
      <>
        <circle cx="38" cy="46" r="3" fill={stroke} />
        <circle cx="62" cy="46" r="3" fill={stroke} />
      </>
    ),
    smile: (
      <>
        <path
          d="M33 48 Q38 42 43 48"
          fill="none"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinecap="round"
        />
        <path
          d="M57 48 Q62 42 67 48"
          fill="none"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinecap="round"
        />
      </>
    ),
    tear: (
      <>
        <path
          d="M33 44 L43 48 M57 48 L67 44"
          fill="none"
          stroke={stroke}
          strokeWidth={sw}
          strokeLinecap="round"
        />
        <path
          d="M40 52 Q37 62 40 66 Q43 62 40 52 Z"
          fill="#6BC0F5"
          stroke={stroke}
          strokeWidth={1.5}
        />
      </>
    ),
    angry: (
      <>
        <path
          d="M33 42 L43 46 M57 46 L67 42"
          fill="none"
          stroke={stroke}
          strokeWidth={sw + 1}
          strokeLinecap="round"
        />
        <circle cx="38" cy="50" r="3" fill={stroke} />
        <circle cx="62" cy="50" r="3" fill={stroke} />
      </>
    ),
    surprised: (
      <>
        <circle cx="38" cy="46" r="5" fill="white" stroke={stroke} strokeWidth={1.5} />
        <circle cx="62" cy="46" r="5" fill="white" stroke={stroke} strokeWidth={1.5} />
        <circle cx="38" cy="46" r="2" fill={stroke} />
        <circle cx="62" cy="46" r="2" fill={stroke} />
      </>
    ),
  };
  const mouth: Record<AvatarEmotion, React.ReactNode> = {
    neutral: (
      <path
        d="M40 68 L60 68"
        fill="none"
        stroke={stroke}
        strokeWidth={sw}
        strokeLinecap="round"
      />
    ),
    smile: (
      <path
        d="M36 64 Q50 78 64 64"
        fill="none"
        stroke={stroke}
        strokeWidth={sw + 0.5}
        strokeLinecap="round"
      />
    ),
    tear: (
      <path
        d="M40 72 Q50 64 60 72"
        fill="none"
        stroke={stroke}
        strokeWidth={sw}
        strokeLinecap="round"
      />
    ),
    angry: (
      <path
        d="M38 68 L44 66 L50 70 L56 66 L62 68"
        fill="none"
        stroke={stroke}
        strokeWidth={sw}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
    surprised: (
      <ellipse
        cx="50"
        cy="70"
        rx="5"
        ry="7"
        fill="#1A1108"
        stroke={stroke}
        strokeWidth={1.5}
      />
    ),
  };
  return (
    <>
      {eyes[emotion]}
      {mouth[emotion]}
    </>
  );
}

function PresetAvatarSvg({
  face,
  skin,
  emotion,
  size,
  className,
}: {
  face: number;
  skin: string;
  emotion: AvatarEmotion;
  size: number;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      style={{ display: "block" }}
      aria-hidden="true"
    >
      <FaceShape face={face} fill={skin} />
      <Emotion emotion={emotion} />
    </svg>
  );
}
