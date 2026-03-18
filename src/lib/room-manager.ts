import { Room, Player, GameSettings } from '@/types/game';
import { generateId, generateRoomCode } from '@/lib/utils';

const MAX_PLAYERS = parseInt(process.env.NEXT_PUBLIC_MAX_PLAYERS ?? '8', 10);
const MAX_AI_PLAYERS = parseInt(process.env.NEXT_PUBLIC_MAX_AI_PLAYERS ?? '5', 10);
const STALE_ROOM_MS = 30 * 60 * 1000; // 30분

const AI_NAMES = ['알파', '베타', '감마', '델타', '엡실론'];

const rooms = new Map<string, Room>();

// ─── 내부 헬퍼 ──────────────────────────────────────────────────────────────

function defaultSettings(): GameSettings {
  return {
    mode: 'liar',
    category: '',
    maxPlayers: MAX_PLAYERS,
    descriptionTimerSec: 60,
    discussionTimerSec: 180,
    voteTimerSec: 30,
    finalDefenseTimerSec: 30,
  };
}

function isCodeTaken(code: string): boolean {
  for (const room of rooms.values()) {
    if (room.code === code) return true;
  }
  return false;
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * 방 생성. 호스트 플레이어 포함 Room을 반환한다.
 */
export function createRoom(hostNickname: string): Room {
  let code: string;
  do {
    code = generateRoomCode();
  } while (isCodeTaken(code));

  const hostId = generateId();

  const host: Player = {
    id: hostId,
    name: hostNickname,
    isAI: false,
    isHost: true,
    isConnected: true,
    isReady: false,
  };

  const room: Room = {
    id: generateId(),
    code,
    hostId,
    players: [host],
    phase: 'waiting',
    settings: defaultSettings(),
    turnOrder: [],
    currentTurnIndex: 0,
    descriptions: [],
    messages: [],
    votes: [],
    createdAt: Date.now(),
  };

  rooms.set(room.id, room);
  return room;
}

export interface JoinRoomResult {
  room: Room;
  player: Player;
}

/**
 * 방 코드로 방에 입장. 새 Player를 생성해 room.players에 추가한다.
 */
export function joinRoom(roomCode: string, nickname: string): JoinRoomResult {
  const room = getRoomByCode(roomCode);

  if (!room) {
    throw new Error('방을 찾을 수 없습니다.');
  }
  if (room.phase !== 'waiting') {
    throw new Error('이미 게임이 시작된 방입니다.');
  }
  if (room.players.length >= room.settings.maxPlayers) {
    throw new Error('방이 가득 찼습니다.');
  }
  if (room.players.some((p) => p.name === nickname)) {
    throw new Error('이미 사용 중인 닉네임입니다.');
  }

  const player: Player = {
    id: generateId(),
    name: nickname,
    isAI: false,
    isHost: false,
    isConnected: true,
    isReady: false,
  };

  room.players.push(player);
  return { room, player };
}

/**
 * AI 플레이어 추가. 자동으로 이름을 지정하고 isReady=true로 설정한다.
 */
export function addAIPlayer(roomId: string): Player {
  const room = rooms.get(roomId);

  if (!room) {
    throw new Error('방을 찾을 수 없습니다.');
  }
  if (room.phase !== 'waiting') {
    throw new Error('대기 중인 방에서만 AI를 추가할 수 있습니다.');
  }
  if (room.players.length >= room.settings.maxPlayers) {
    throw new Error('방이 가득 찼습니다.');
  }

  const currentAICount = room.players.filter((p) => p.isAI).length;
  if (currentAICount >= MAX_AI_PLAYERS) {
    throw new Error(`AI 플레이어는 최대 ${MAX_AI_PLAYERS}명까지 추가할 수 있습니다.`);
  }

  const aiName = `AI ${AI_NAMES[currentAICount] ?? currentAICount + 1}`;
  const player: Player = {
    id: generateId(),
    name: aiName,
    isAI: true,
    aiLevel: 'local',
    isHost: false,
    isConnected: true,
    isReady: true,
  };

  room.players.push(player);
  return player;
}

/**
 * 플레이어 제거. 호스트가 나가면 다음 인간 플레이어(없으면 첫 번째 플레이어)가 호스트가 된다.
 * 방에 아무도 없으면 방을 삭제한다.
 */
export function removePlayer(roomId: string, playerId: string): Room {
  const room = rooms.get(roomId);

  if (!room) {
    throw new Error('방을 찾을 수 없습니다.');
  }

  const playerIndex = room.players.findIndex((p) => p.id === playerId);
  if (playerIndex === -1) {
    throw new Error('플레이어를 찾을 수 없습니다.');
  }

  room.players.splice(playerIndex, 1);

  if (room.players.length === 0) {
    rooms.delete(roomId);
    return room;
  }

  // 호스트가 나간 경우 새 호스트 지정
  if (playerId === room.hostId) {
    const newHost = room.players.find((p) => !p.isAI) ?? room.players[0];
    newHost.isHost = true;
    room.hostId = newHost.id;
  }

  return room;
}

/**
 * ID로 방 조회.
 */
export function getRoom(roomId: string): Room | undefined {
  return rooms.get(roomId);
}

/**
 * 6자리 코드로 방 조회 (대소문자 무시).
 */
export function getRoomByCode(roomCode: string): Room | undefined {
  const upper = roomCode.toUpperCase();
  for (const room of rooms.values()) {
    if (room.code === upper) return room;
  }
  return undefined;
}

/**
 * 방 삭제. 성공하면 true, 존재하지 않으면 false.
 */
export function deleteRoom(roomId: string): boolean {
  return rooms.delete(roomId);
}

/**
 * 30분 이상 비활성 방을 정리한다. 삭제된 방 수를 반환한다.
 * 활성 기준: phaseStartAt이 있으면 그 시각, 없으면 createdAt.
 */
export function cleanupStaleRooms(): number {
  const now = Date.now();
  let count = 0;

  for (const [id, room] of rooms) {
    const lastActivity = room.phaseStartAt ?? room.createdAt;
    if (now - lastActivity > STALE_ROOM_MS) {
      rooms.delete(id);
      count++;
    }
  }

  return count;
}

// ─── 테스트 전용 ─────────────────────────────────────────────────────────────

/** @internal 테스트에서 상태 초기화용 */
export function _clearAllRooms(): void {
  rooms.clear();
}

/** @internal 현재 방 수 확인용 */
export function _getRoomCount(): number {
  return rooms.size;
}
