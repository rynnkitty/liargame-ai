'use client';

import { io, Socket } from 'socket.io-client';
import type { ClientToServerEvents, ServerToClientEvents } from '@/types/socket-events';

export type AppSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let _socket: AppSocket | null = null;

/**
 * Socket.IO 클라이언트 싱글톤을 반환합니다.
 * 처음 호출 시 인스턴스를 생성하며, 이후 호출은 동일한 인스턴스를 반환합니다.
 * autoConnect: false이므로 connectSocket()을 명시적으로 호출해야 합니다.
 */
export function getSocket(): AppSocket {
  if (!_socket) {
    _socket = io({
      autoConnect: false,
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
    });

    _socket.on('connect', () => {
      console.info('[Socket] 서버 연결됨:', _socket!.id);
    });

    _socket.on('disconnect', (reason) => {
      console.warn('[Socket] 연결 해제:', reason);
    });

    _socket.on('connect_error', (err) => {
      console.error('[Socket] 연결 오류:', err.message);
    });
  }

  return _socket;
}

/** 소켓 연결을 시작합니다. */
export function connectSocket(): void {
  getSocket().connect();
}

/** 소켓 연결을 해제하고 인스턴스를 초기화합니다. */
export function disconnectSocket(): void {
  if (_socket) {
    _socket.disconnect();
    _socket = null;
  }
}

/** 현재 소켓 연결 상태를 반환합니다. */
export function isConnected(): boolean {
  return _socket?.connected ?? false;
}
