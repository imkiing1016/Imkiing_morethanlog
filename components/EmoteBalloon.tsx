"use client";

import { useEffect, useState } from "react";
import { EMOTE_EMOJI } from "@/game/types";
import type { ActiveEmote } from "@/game/types";

// 플레이어 슬롯 위로 떠오르는 풍선 이모트. 3초 후 자동 사라짐.
// 부모(PlayerDock 슬롯)가 relative 이어야 함 (absolute 로 슬롯 상단에 붙음).
export default function EmoteBalloon({ emote }: { emote: ActiveEmote }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const elapsed = Date.now() - emote.ts;
    const remaining = Math.max(0, 3000 - elapsed);
    const t = setTimeout(() => setVisible(false), remaining);
    return () => clearTimeout(t);
  }, [emote.ts, emote.id]);

  if (!visible) return null;

  return (
    <span
      key={emote.id}
      className="emote-balloon absolute -top-8 left-1/2 -translate-x-1/2 pointer-events-none text-3xl select-none"
      aria-hidden
    >
      {EMOTE_EMOJI[emote.kind]}
    </span>
  );
}
