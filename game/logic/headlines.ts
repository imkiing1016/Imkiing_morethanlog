// 글로벌 이벤트 헤드라인 (섹터 × 방향). SPEC 3.6 — 시장 전체 뉴스.
// 각 섹터마다 up/down 2건 이상. 랜덤 선택.
import type { Sector } from "../types";

export const HEADLINES: Record<Sector, { up: string[]; down: string[] }> = {
  IT_GAME: {
    up: ["AI 붐 — IT/게임 호조", "신작 흥행 — IT/게임 강세"],
    down: ["사이버 공격 — IT/게임 충격", "규제 강화 — IT/게임 침체"],
  },
  BEAUTY: {
    up: ["K뷰티 글로벌 인기 — 뷰티 호조", "한류 효과 — 뷰티 강세"],
    down: ["원료비 급등 — 뷰티 부진", "수출 둔화 — 뷰티 약세"],
  },
  CONSTRUCTION: {
    up: ["인프라 부양 — 건설 호조", "주택 공급 확대 — 건설 강세"],
    down: ["철근 가격 급락 — 건설 부진", "분양 미달 — 건설 약세"],
  },
  RETAIL: {
    up: ["소비 회복 — 유통 호조", "온라인 쇼핑 폭증 — 유통 강세"],
    down: ["물류 대란 — 유통 부진", "소비 위축 — 유통 약세"],
  },
  BIO: {
    up: ["신약 승인 — 바이오 호조", "R&D 보조금 확대 — 바이오 강세"],
    down: ["임상 실패 — 바이오 부진", "감염병 잠잠 — 바이오 약세"],
  },
  DEFENSE: {
    up: ["방산 수출 호조 — 방산 강세", "안보 긴장 고조 — 방산 호조"],
    down: ["방산 예산 삭감 — 방산 부진", "평화 협정 — 방산 약세"],
  },
};

export function pickHeadline(sector: Sector, isUp: boolean): string {
  const list = HEADLINES[sector][isUp ? "up" : "down"];
  return list[Math.floor(Math.random() * list.length)];
}
