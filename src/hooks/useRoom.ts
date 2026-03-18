'use client';

import { useGameStore } from '@/store/game-store';
import type { Player } from '@/types/game';

export function useRoom() {
  const { room, myPlayerId, phase } = useGameStore();

  const myPlayer: Player | undefined = room?.players.find((p) => p.id === myPlayerId);
  const isHost = myPlayer?.isHost ?? false;

  const currentTurnPlayer = room
    ? room.players.find((p) => p.id === room.turnOrder[room.currentTurnIndex])
    : undefined;

  const isMyTurn = currentTurnPlayer?.id === myPlayerId;

  const humanPlayers = room?.players.filter((p) => !p.isAI) ?? [];
  const aiPlayers = room?.players.filter((p) => p.isAI) ?? [];

  return {
    room,
    myPlayer,
    isHost,
    myPlayerId,
    phase,
    currentTurnPlayer,
    isMyTurn,
    humanPlayers,
    aiPlayers,
  };
}
