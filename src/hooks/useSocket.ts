'use client';

import { useEffect, useRef } from 'react';
import { getSocket, connectSocket } from '@/lib/socket/client';
import { useGameStore } from '@/store/game-store';
import { toast } from '@/hooks/use-toast';
import type { ServerToClientEvents } from '@/types/socket-events';

export function useSocket() {
  const socket = getSocket();
  const initialized = useRef(false);

  const {
    setRoom,
    setPhase,
    setMyRole,
    setMyKeyword,
    setMyCategory,
    setPhaseTimer,
    addMessage,
    addDescription,
  } = useGameStore();

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const onRoomUpdated: ServerToClientEvents['room:updated'] = ({ room }) => setRoom(room);
    const onPlayerJoined: ServerToClientEvents['room:player_joined'] = ({ room }) => setRoom(room);
    const onPlayerLeft: ServerToClientEvents['room:player_left'] = ({ room }) => setRoom(room);

    const onPhaseChange: ServerToClientEvents['game:phase_change'] = ({
      phase,
      phaseStartAt,
      durationSec,
    }) => {
      setPhase(phase);
      setPhaseTimer(phaseStartAt, durationSec);
    };

    const onRoleAssigned: ServerToClientEvents['game:role_assigned'] = ({
      role,
      keyword,
      category,
    }) => {
      setMyRole(role);
      setMyCategory(category);
      setMyKeyword(keyword ?? null);
    };

    const onDescriptionSubmitted: ServerToClientEvents['game:description_submitted'] = ({
      description,
    }) => {
      addDescription(description);
    };

    const onMessageReceived: ServerToClientEvents['game:message_received'] = ({ message }) => {
      addMessage(message);
    };

    const onError: ServerToClientEvents['error'] = ({ message }) => {
      toast({ variant: 'destructive', title: '오류', description: message });
    };

    const onNotification: ServerToClientEvents['notification'] = ({ message, type }) => {
      toast({ title: message, variant: type === 'warn' ? 'destructive' : 'default' });
    };

    socket.on('room:updated', onRoomUpdated);
    socket.on('room:player_joined', onPlayerJoined);
    socket.on('room:player_left', onPlayerLeft);
    socket.on('game:phase_change', onPhaseChange);
    socket.on('game:role_assigned', onRoleAssigned);
    socket.on('game:description_submitted', onDescriptionSubmitted);
    socket.on('game:message_received', onMessageReceived);
    socket.on('error', onError);
    socket.on('notification', onNotification);

    connectSocket();

    return () => {
      socket.off('room:updated', onRoomUpdated);
      socket.off('room:player_joined', onPlayerJoined);
      socket.off('room:player_left', onPlayerLeft);
      socket.off('game:phase_change', onPhaseChange);
      socket.off('game:role_assigned', onRoleAssigned);
      socket.off('game:description_submitted', onDescriptionSubmitted);
      socket.off('game:message_received', onMessageReceived);
      socket.off('error', onError);
      socket.off('notification', onNotification);
      initialized.current = false;
    };
  }, []);

  return socket;
}
