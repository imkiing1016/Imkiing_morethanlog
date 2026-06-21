import { create } from "zustand";
import type { GameState } from "@/party/types";

export type ConnectionStatus = "connecting" | "connected" | "disconnected";

// 클라 상태: 서버 스냅샷을 수신해 보관할 뿐, 게임 계산은 하지 않는다. (SPEC 0장/8장)
interface ClientStore {
  status: ConnectionStatus;
  state: GameState | null;
  selfId: string | null;
  setStatus: (status: ConnectionStatus) => void;
  setSnapshot: (state: GameState, selfId: string) => void;
  reset: () => void;
}

export const useGameStore = create<ClientStore>((set) => ({
  status: "connecting",
  state: null,
  selfId: null,
  setStatus: (status) => set({ status }),
  setSnapshot: (state, selfId) => set({ state, selfId }),
  reset: () => set({ status: "connecting", state: null, selfId: null }),
}));
