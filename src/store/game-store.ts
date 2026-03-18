import { create } from 'zustand';
import type { Room, Phase, Role, Message, Description } from '@/types/game';

interface GameStore {
  // 현재 방 정보 (서버에서 동기화)
  room: Room | null;
  // 현재 게임 단계
  phase: Phase;
  // 내 플레이어 ID (소켓 연결 후 할당)
  myPlayerId: string | null;
  // 내 역할 (role_reveal 단계에서 서버로부터 수신)
  myRole: Role | null;
  // 내 키워드 (시민에게만 전달)
  myKeyword: string | null;
  // 현재 카테고리
  myCategory: string | null;
  // 현재 phase 시작 시각 (game:phase_change 이벤트에서 수신)
  phaseStartAt: number | null;
  // 현재 phase 지속 시간(초)
  phaseDurationSec: number;

  // Actions
  setRoom: (room: Room) => void;
  setPhase: (phase: Phase) => void;
  setMyPlayerId: (id: string) => void;
  setMyRole: (role: Role) => void;
  setMyKeyword: (keyword: string | null) => void;
  setMyCategory: (category: string) => void;
  setPhaseTimer: (phaseStartAt: number, phaseDurationSec: number) => void;
  addMessage: (message: Message) => void;
  addDescription: (description: Description) => void;
  reset: () => void;
}

const initialState = {
  room: null,
  phase: 'waiting' as Phase,
  myPlayerId: null,
  myRole: null,
  myKeyword: null,
  myCategory: null,
  phaseStartAt: null,
  phaseDurationSec: 0,
};

export const useGameStore = create<GameStore>((set) => ({
  ...initialState,

  setRoom: (room) => set({ room, phase: room.phase }),
  setPhase: (phase) => set({ phase }),
  setMyPlayerId: (myPlayerId) => set({ myPlayerId }),
  setMyRole: (myRole) => set({ myRole }),
  setMyKeyword: (myKeyword) => set({ myKeyword }),
  setMyCategory: (myCategory) => set({ myCategory }),
  setPhaseTimer: (phaseStartAt, phaseDurationSec) => set({ phaseStartAt, phaseDurationSec }),
  addMessage: (message) =>
    set((state) => {
      if (!state.room) return state;
      if (state.room.messages.some((m) => m.id === message.id)) return state;
      return { room: { ...state.room, messages: [...state.room.messages, message] } };
    }),
  addDescription: (description) =>
    set((state) => {
      if (!state.room) return state;
      const exists = state.room.descriptions.some(
        (d) => d.playerId === description.playerId && d.submittedAt === description.submittedAt,
      );
      if (exists) return state;
      return {
        room: {
          ...state.room,
          descriptions: [...state.room.descriptions, description],
          currentTurnIndex: state.room.currentTurnIndex + 1,
        },
      };
    }),
  reset: () => set(initialState),
}));
