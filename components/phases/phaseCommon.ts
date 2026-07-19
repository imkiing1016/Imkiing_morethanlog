// 페이즈 뷰 공통 유틸/타입. 각 페이즈 컴포넌트가 임포트해서 사용.
import type {
  ClientMessage,
  Company,
  GameState,
  PlayerState,
} from "@/game/types";

export const fmt = (n: number) => n.toLocaleString("ko-KR") + "원";

// 각 페이즈 뷰가 공통으로 받는 props. 지역 상태(입력 폼 등)는 각 뷰 안에서 관리.
export interface PhaseViewProps {
  state: GameState;
  self: PlayerState | undefined;
  selfId: string | null;
  send: (msg: ClientMessage) => void;
  myCompany: Company | undefined;
  connected: PlayerState[];
  readyCount: number;
  // TRADE / MANAGE 에서 카운트다운 렌더용. 부모가 250ms 간격으로 tick.
  now: number;
}
