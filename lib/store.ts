import { create } from "zustand";
import type { GameState } from "@/party/types";

// 클라 상태: 서버 스냅샷을 수신해 보관할 뿐, 게임 계산은 하지 않는다. (SPEC 0장/8장)
interface ClientStore {
  state: GameState | null;
  selfId: string | null;
  setSnapshot: (state: GameState, selfId: string) => void;
  reset: () => void;
}

export const useGameStore = create<ClientStore>((set) => ({
  state: null,
  selfId: null,
  setSnapshot: (state, selfId) => set({ state, selfId }),
  reset: () => set({ state: null, selfId: null }),
}));
