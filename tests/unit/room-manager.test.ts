import { describe, it, expect, beforeEach } from 'vitest';
import {
  createRoom,
  joinRoom,
  addAIPlayer,
  removePlayer,
  getRoom,
  getRoomByCode,
  deleteRoom,
  cleanupStaleRooms,
  _clearAllRooms,
  _getRoomCount,
} from '@/lib/room-manager';

beforeEach(() => {
  _clearAllRooms();
});

// ─── createRoom ───────────────────────────────────────────────────────────────

describe('createRoom', () => {
  it('방을 생성하고 호스트를 포함한 Room을 반환한다', () => {
    const room = createRoom('홍길동');

    expect(room.id).toBeDefined();
    expect(room.code).toHaveLength(6);
    expect(room.phase).toBe('waiting');
    expect(room.players).toHaveLength(1);
    expect(room.players[0].name).toBe('홍길동');
    expect(room.players[0].isHost).toBe(true);
    expect(room.players[0].isAI).toBe(false);
    expect(room.players[0].isConnected).toBe(true);
  });

  it('방 코드는 6자리 대문자 알파벳+숫자다', () => {
    const room = createRoom('테스트');
    expect(room.code).toMatch(/^[A-Z2-9]{6}$/);
  });

  it('기본 설정으로 방이 생성된다', () => {
    const room = createRoom('호스트');
    expect(room.settings.mode).toBe('liar');
    expect(room.settings.descriptionTimerSec).toBe(60);
    expect(room.settings.discussionTimerSec).toBe(180);
    expect(room.settings.voteTimerSec).toBe(30);
    expect(room.settings.finalDefenseTimerSec).toBe(30);
  });

  it('생성된 방이 내부 저장소에 보관된다', () => {
    const room = createRoom('호스트');
    expect(_getRoomCount()).toBe(1);
    expect(getRoom(room.id)).toBe(room);
  });

  it('여러 방 생성 시 ID와 코드가 각기 다르다', () => {
    const room1 = createRoom('플레이어1');
    const room2 = createRoom('플레이어2');

    expect(room1.id).not.toBe(room2.id);
    expect(room1.code).not.toBe(room2.code);
  });

  it('hostId와 첫 플레이어 id가 일치한다', () => {
    const room = createRoom('호스트');
    expect(room.hostId).toBe(room.players[0].id);
  });
});

// ─── joinRoom ─────────────────────────────────────────────────────────────────

describe('joinRoom', () => {
  it('방 코드로 방에 입장하면 플레이어가 추가된다', () => {
    const room = createRoom('호스트');
    const { room: updated, player } = joinRoom(room.code, '참가자');

    expect(updated.players).toHaveLength(2);
    expect(player.name).toBe('참가자');
    expect(player.isHost).toBe(false);
    expect(player.isConnected).toBe(true);
    expect(player.isAI).toBe(false);
  });

  it('소문자 코드로도 입장할 수 있다', () => {
    const room = createRoom('호스트');
    const { room: updated } = joinRoom(room.code.toLowerCase(), '참가자');
    expect(updated.players).toHaveLength(2);
  });

  it('존재하지 않는 코드로 입장 시 에러를 던진다', () => {
    expect(() => joinRoom('XXXXXX', '참가자')).toThrow('방을 찾을 수 없습니다.');
  });

  it('이미 게임이 시작된 방에는 입장할 수 없다', () => {
    const room = createRoom('호스트');
    room.phase = 'description';

    expect(() => joinRoom(room.code, '참가자')).toThrow('이미 게임이 시작된 방입니다.');
  });

  it('이미 사용 중인 닉네임으로 입장 시 에러를 던진다', () => {
    const room = createRoom('호스트');
    expect(() => joinRoom(room.code, '호스트')).toThrow('이미 사용 중인 닉네임입니다.');
  });

  it('방이 가득 찬 경우 입장할 수 없다', () => {
    const room = createRoom('호스트');
    room.settings.maxPlayers = 2;
    joinRoom(room.code, '참가자1');

    expect(() => joinRoom(room.code, '참가자2')).toThrow('방이 가득 찼습니다.');
  });
});

// ─── addAIPlayer ──────────────────────────────────────────────────────────────

describe('addAIPlayer', () => {
  it('AI 플레이어를 추가할 수 있다', () => {
    const room = createRoom('호스트');
    const aiPlayer = addAIPlayer(room.id);

    expect(aiPlayer.isAI).toBe(true);
    expect(aiPlayer.isReady).toBe(true);
    expect(aiPlayer.aiLevel).toBe('local');
    expect(aiPlayer.isHost).toBe(false);
    expect(getRoom(room.id)!.players).toHaveLength(2);
  });

  it('AI 이름은 순서대로 다르게 지정된다', () => {
    const room = createRoom('호스트');
    const ai1 = addAIPlayer(room.id);
    const ai2 = addAIPlayer(room.id);

    expect(ai1.name).not.toBe(ai2.name);
  });

  it('존재하지 않는 방에 AI 추가 시 에러를 던진다', () => {
    expect(() => addAIPlayer('non-existent-id')).toThrow('방을 찾을 수 없습니다.');
  });

  it('게임 중인 방에는 AI를 추가할 수 없다', () => {
    const room = createRoom('호스트');
    room.phase = 'description';

    expect(() => addAIPlayer(room.id)).toThrow('대기 중인 방에서만 AI를 추가할 수 있습니다.');
  });

  it('방이 가득 찬 경우 AI를 추가할 수 없다', () => {
    const room = createRoom('호스트');
    room.settings.maxPlayers = 1;

    expect(() => addAIPlayer(room.id)).toThrow('방이 가득 찼습니다.');
  });

  it('AI를 5명 초과 추가할 수 없다', () => {
    const room = createRoom('호스트');
    room.settings.maxPlayers = 10;

    for (let i = 0; i < 5; i++) {
      addAIPlayer(room.id);
    }

    expect(() => addAIPlayer(room.id)).toThrow('AI 플레이어는 최대 5명까지 추가할 수 있습니다.');
  });
});

// ─── removePlayer ─────────────────────────────────────────────────────────────

describe('removePlayer', () => {
  it('플레이어를 방에서 제거할 수 있다', () => {
    const room = createRoom('호스트');
    const { player } = joinRoom(room.code, '참가자');

    const updatedRoom = removePlayer(room.id, player.id);
    expect(updatedRoom.players).toHaveLength(1);
    expect(updatedRoom.players.find((p) => p.id === player.id)).toBeUndefined();
  });

  it('호스트가 나가면 다른 인간 플레이어가 호스트가 된다', () => {
    const room = createRoom('호스트');
    const { player: newPlayer } = joinRoom(room.code, '참가자');
    const oldHostId = room.hostId;

    const updatedRoom = removePlayer(room.id, oldHostId);
    expect(updatedRoom.hostId).toBe(newPlayer.id);
    expect(updatedRoom.players[0].isHost).toBe(true);
  });

  it('인간 플레이어가 없으면 AI가 호스트가 된다', () => {
    const room = createRoom('호스트');
    addAIPlayer(room.id);
    const oldHostId = room.hostId;

    const updatedRoom = removePlayer(room.id, oldHostId);
    expect(updatedRoom.players[0].isHost).toBe(true);
    expect(updatedRoom.players[0].isAI).toBe(true);
  });

  it('마지막 플레이어가 나가면 방이 삭제된다', () => {
    const room = createRoom('호스트');
    removePlayer(room.id, room.hostId);

    expect(getRoom(room.id)).toBeUndefined();
    expect(_getRoomCount()).toBe(0);
  });

  it('존재하지 않는 방에서 플레이어 제거 시 에러를 던진다', () => {
    expect(() => removePlayer('non-existent', 'player-id')).toThrow('방을 찾을 수 없습니다.');
  });

  it('존재하지 않는 플레이어 제거 시 에러를 던진다', () => {
    const room = createRoom('호스트');
    expect(() => removePlayer(room.id, 'non-existent-player')).toThrow(
      '플레이어를 찾을 수 없습니다.',
    );
  });
});

// ─── getRoom ──────────────────────────────────────────────────────────────────

describe('getRoom', () => {
  it('ID로 방을 조회할 수 있다', () => {
    const room = createRoom('호스트');
    expect(getRoom(room.id)).toBe(room);
  });

  it('존재하지 않는 방 조회 시 undefined를 반환한다', () => {
    expect(getRoom('non-existent')).toBeUndefined();
  });
});

// ─── getRoomByCode ────────────────────────────────────────────────────────────

describe('getRoomByCode', () => {
  it('코드로 방을 조회할 수 있다', () => {
    const room = createRoom('호스트');
    expect(getRoomByCode(room.code)?.id).toBe(room.id);
  });

  it('소문자 코드로도 조회할 수 있다', () => {
    const room = createRoom('호스트');
    expect(getRoomByCode(room.code.toLowerCase())?.id).toBe(room.id);
  });

  it('존재하지 않는 코드로 조회 시 undefined를 반환한다', () => {
    expect(getRoomByCode('XXXXXX')).toBeUndefined();
  });
});

// ─── deleteRoom ───────────────────────────────────────────────────────────────

describe('deleteRoom', () => {
  it('방을 삭제하면 true를 반환하고 방이 사라진다', () => {
    const room = createRoom('호스트');
    expect(deleteRoom(room.id)).toBe(true);
    expect(getRoom(room.id)).toBeUndefined();
  });

  it('존재하지 않는 방 삭제 시 false를 반환한다', () => {
    expect(deleteRoom('non-existent')).toBe(false);
  });
});

// ─── cleanupStaleRooms ────────────────────────────────────────────────────────

describe('cleanupStaleRooms', () => {
  it('30분 이상 비활성 방을 삭제하고 삭제 수를 반환한다', () => {
    const room1 = createRoom('호스트1');
    const room2 = createRoom('호스트2');

    // room1을 31분 전에 생성된 것처럼 조작
    room1.createdAt = Date.now() - 31 * 60 * 1000;

    const removed = cleanupStaleRooms();
    expect(removed).toBe(1);
    expect(getRoom(room1.id)).toBeUndefined();
    expect(getRoom(room2.id)).toBeDefined();
  });

  it('phaseStartAt이 있으면 createdAt 대신 기준으로 사용한다', () => {
    const room = createRoom('호스트');
    room.createdAt = Date.now() - 31 * 60 * 1000;
    room.phaseStartAt = Date.now() - 5 * 60 * 1000; // 5분 전 활동

    const removed = cleanupStaleRooms();
    expect(removed).toBe(0);
    expect(getRoom(room.id)).toBeDefined();
  });

  it('정리할 방이 없으면 0을 반환한다', () => {
    createRoom('호스트');
    expect(cleanupStaleRooms()).toBe(0);
  });

  it('모든 방이 오래됐으면 전부 삭제한다', () => {
    const r1 = createRoom('호스트1');
    const r2 = createRoom('호스트2');
    r1.createdAt = Date.now() - 31 * 60 * 1000;
    r2.createdAt = Date.now() - 60 * 60 * 1000;

    const removed = cleanupStaleRooms();
    expect(removed).toBe(2);
    expect(_getRoomCount()).toBe(0);
  });
});
