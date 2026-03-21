'use client';

import { getSocket } from '@/lib/socket/client';
import { useGameStore } from '@/store/game-store';
import { useSettingsStore } from '@/store/settings-store';
import { toast } from '@/hooks/use-toast';

export function useGame() {
  const { room } = useGameStore();
  const socket = getSocket();
  const apiKey = useSettingsStore((s) => s.apiKey);

  const submitDescription = (text: string, onSuccess?: () => void) => {
    if (!room) return;
    socket.emit('game:submit_description', { roomId: room.id, text }, (res) => {
      if (!res.ok) {
        toast({ variant: 'destructive', title: '오류', description: res.error });
      } else {
        onSuccess?.();
      }
    });
  };

  const sendMessage = (text: string) => {
    if (!room || !text.trim()) return;
    socket.emit('game:send_message', { roomId: room.id, text }, (res) => {
      if (!res.ok) {
        toast({ variant: 'destructive', title: '오류', description: res.error });
      }
    });
  };

  const submitVote = (targetId: string) => {
    if (!room) return;
    socket.emit('game:submit_vote', { roomId: room.id, targetId }, (res) => {
      if (!res.ok) {
        toast({ variant: 'destructive', title: '오류', description: res.error });
      }
    });
  };

  const submitFinalDefense = (keyword: string) => {
    if (!room) return;
    socket.emit('game:submit_final_defense', { roomId: room.id, keyword }, (res) => {
      if (!res.ok) {
        toast({ variant: 'destructive', title: '오류', description: res.error });
      }
    });
  };

  const playAgain = () => {
    if (!room) return;
    socket.emit('room:play_again', { roomId: room.id }, (res) => {
      if (!res.ok) {
        toast({ variant: 'destructive', title: '오류', description: res.error });
      }
    });
  };

  const startGame = (onError?: (msg: string) => void) => {
    if (!room) return;
    socket.emit('room:start', { roomId: room.id, apiKey: apiKey || undefined }, (res) => {
      if (!res.ok) {
        onError?.(res.error);
        toast({ variant: 'destructive', title: '게임 시작 실패', description: res.error });
      }
    });
  };

  return { submitDescription, sendMessage, submitVote, submitFinalDefense, playAgain, startGame };
}
