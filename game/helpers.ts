// 여러 모듈에서 반복되는 소소한 유틸.
// 상수 계산·안전 클램프·평가액 산정 등.
import type { Company, GameState, PlayerState } from "./types";

// 신뢰도 배열 인덱스 안전화 — 신뢰도가 밴드를 벗어나 인덱싱 실패하는 것을 방지.
export function clampTrust(trust: number): number {
  return Math.max(0, Math.min(5, trust));
}

// 플레이어의 보유 주식 평가액 (자기 회사 주식 포함).
// UI/랭킹/봇 판단 등에서 반복적으로 계산되는 값.
export function computeStocksValue(
  player: PlayerState,
  companies: Record<string, Company>
): number {
  let sum = 0;
  for (const [cid, n] of Object.entries(player.holdings)) {
    const co = companies[cid];
    if (co) sum += n * co.price;
  }
  return sum;
}

// 관리 페이즈 핸들러 서두 검증 헬퍼.
// 페이즈·플레이어·회사 모두 유효할 때만 { player, co } 반환, 아니면 null.
export function getManageContext(
  state: GameState,
  id: string
): { player: PlayerState; co: Company } | null {
  if (state.phase !== "MANAGE") return null;
  const player = state.players.find((p) => p.id === id);
  if (!player) return null;
  const co = state.companies[id];
  if (!co) return null;
  return { player, co };
}
