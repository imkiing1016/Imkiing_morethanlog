import type { Avatar } from "@/game/types";
import { ANIMAL_LIST, AVATAR_BG_COLORS } from "@/game/types";

// 아바타 프리셋/손그림은 게임 식별자(SPEC 8장 금지 범위) 가 아니라 순수 코스메틱.
// 재접속마다 편집 재입력하기 번거로우니 localStorage 로 보관 허용.
const KEY = "avatar_v1";

export function loadAvatar(): Avatar {
  if (typeof window === "undefined") return defaultAvatar();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultAvatar();
    const parsed = JSON.parse(raw) as Avatar;
    return { ...defaultAvatar(), ...parsed };
  } catch {
    return defaultAvatar();
  }
}

export function saveAvatar(avatar: Avatar) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(avatar));
  } catch {}
}

// 기본값: 여우 · 장식 없음 · 크림 배경. 첫 접속 유저에게 무난한 캐릭터.
export function defaultAvatar(): Avatar {
  return {
    animalId: ANIMAL_LIST[1]?.id ?? "fox",
    ornamentId: "none",
    bgColor: AVATAR_BG_COLORS[0]?.hex ?? "#FFF6E0",
  };
}
