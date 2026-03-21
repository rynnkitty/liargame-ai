import type {
  Phase,
  Player,
  Room,
  Description,
  Message,
  Vote,
  VoteSummary,
  GameResult,
  GameSettings,
} from './game';

// ──────────────────────────────────────────────
// 공통 콜백 타입
// ──────────────────────────────────────────────
export interface SocketCallback<T = void> {
  (response: { ok: true; data: T } | { ok: false; error: string }): void;
}

// ──────────────────────────────────────────────
// 클라이언트 → 서버 이벤트 (emit)
// ──────────────────────────────────────────────
export interface ClientToServerEvents {
  // 방 생성 (호스트)
  'room:create': (
    payload: { playerName: string },
    callback: SocketCallback<{ room: Room; playerId: string }>
  ) => void;

  // 방 입장/퇴장
  'room:join': (
    payload: { roomCode: string; playerName: string },
    callback: SocketCallback<{ room: Room; playerId: string }>
  ) => void;
  'room:leave': (payload: { roomId: string }) => void;

  // 호스트 전용
  'room:start': (
    payload: { roomId: string; apiKey?: string },
    callback: SocketCallback<void>
  ) => void;
  'room:add_ai': (
    payload: { roomId: string; aiName?: string },
    callback: SocketCallback<{ player: Player }>
  ) => void;
  'room:remove_player': (
    payload: { roomId: string; targetPlayerId: string },
    callback: SocketCallback<void>
  ) => void;
  'room:update_settings': (
    payload: { roomId: string; settings: Partial<GameSettings> },
    callback: SocketCallback<void>
  ) => void;

  // 게임 액션
  'game:submit_description': (
    payload: { roomId: string; text: string },
    callback: SocketCallback<void>
  ) => void;
  'game:send_message': (
    payload: { roomId: string; text: string },
    callback: SocketCallback<{ message: Message }>
  ) => void;
  'game:submit_vote': (
    payload: { roomId: string; targetId: string },
    callback: SocketCallback<void>
  ) => void;
  'game:submit_final_defense': (
    payload: { roomId: string; keyword: string },
    callback: SocketCallback<void>
  ) => void;

  // 다음 게임
  'room:play_again': (
    payload: { roomId: string },
    callback: SocketCallback<void>
  ) => void;
}

// ──────────────────────────────────────────────
// 서버 → 클라이언트 이벤트 (on)
// ──────────────────────────────────────────────
export interface ServerToClientEvents {
  // 방 상태 변경
  'room:updated': (payload: { room: Room }) => void;
  'room:player_joined': (payload: { player: Player; room: Room }) => void;
  'room:player_left': (payload: { playerId: string; room: Room }) => void;

  // 게임 단계 전환
  'game:phase_change': (payload: {
    phase: Phase;
    turnOrder?: string[];
    phaseStartAt: number;
    durationSec: number;
  }) => void;

  // 역할 전달 (개인 이벤트 — 해당 소켓에만)
  'game:role_assigned': (payload: {
    role: 'citizen' | 'liar';
    keyword?: string;   // citizen만 수신
    category: string;
  }) => void;

  // 설명 단계
  'game:description_submitted': (payload: {
    description: Description;
    nextTurnPlayerId?: string;
  }) => void;
  'game:your_turn': (payload: { timeoutSec: number }) => void;

  // 토론 단계
  'game:message_received': (payload: { message: Message }) => void;

  // 투표 단계
  'game:vote_submitted': (payload: {
    voterId: string;
    voteCount: number;
    totalPlayers: number;
  }) => void;
  'game:vote_result': (payload: {
    summary: VoteSummary[];
    liarCaught: boolean;
    liarId: string;
  }) => void;

  // 최종 변론
  'game:final_defense_submitted': (payload: {
    keyword: string;
    correct: boolean;
  }) => void;

  // 결과
  'game:result': (payload: { result: GameResult }) => void;

  // 오류/알림
  'error': (payload: { message: string; code?: string }) => void;
  'notification': (payload: { message: string; type: 'info' | 'warn' }) => void;
}

// ──────────────────────────────────────────────
// Socket 데이터 (handshake)
// ──────────────────────────────────────────────
export interface SocketData {
  playerId: string;
  roomId: string;
  playerName: string;
}
