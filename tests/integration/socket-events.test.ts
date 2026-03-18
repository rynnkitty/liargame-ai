// @vitest-environment node
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioc, Socket } from 'socket.io-client';
import type { AddressInfo } from 'net';
import { initSocketServer } from '@/lib/socket/server';
import { _clearAllRooms, getRoom } from '@/lib/room-manager';

// ─── 테스트 서버 셋업 ─────────────────────────────────────────────────────────

let httpServer: ReturnType<typeof createServer>;
let ioServer: Server;
let port: number;

beforeAll(
  () =>
    new Promise<void>((resolve) => {
      httpServer = createServer();
      ioServer = new Server(httpServer, {
        cors: { origin: '*' },
        transports: ['websocket'],
        // 긴 타임아웃으로 페이크 타이머 간섭 방지
        pingInterval: 60_000,
        pingTimeout: 60_000,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initSocketServer(ioServer as any);
      httpServer.listen(0, () => {
        port = (httpServer.address() as AddressInfo).port;
        resolve();
      });
    }),
);

afterAll(
  () =>
    new Promise<void>((resolve) => {
      ioServer.close();
      httpServer.close(() => resolve());
    }),
);

beforeEach(() => {
  _clearAllRooms();
});

// ─── 헬퍼 ────────────────────────────────────────────────────────────────────

/** 테스트용 소켓 클라이언트 생성 */
function createClient(): Socket {
  return ioc(`http://localhost:${port}`, {
    transports: ['websocket'],
    autoConnect: true,
    reconnection: false,
  });
}

/** 소켓 연결 대기 */
function waitConnect(socket: Socket): Promise<void> {
  return new Promise((resolve) => socket.on('connect', resolve));
}

/** 특정 이벤트 수신 대기 */
function waitEvent<T>(socket: Socket, event: string): Promise<T> {
  return new Promise((resolve) => socket.once(event as never, resolve));
}

/** 콜백 기반 emit을 Promise로 래핑 */
function emitCb<T>(socket: Socket, event: string, payload: unknown): Promise<T> {
  return new Promise((resolve, reject) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (socket as any).emit(
      event,
      payload,
      (res: { ok: boolean; data?: T; error?: string }) => {
        if (res.ok) resolve(res.data as T);
        else reject(new Error(res.error ?? '알 수 없는 오류'));
      },
    );
  });
}

/** 이벤트 루프 비우기 (TCP 소켓 이벤트 전파 대기) */
async function drainEventLoop(ticks = 5): Promise<void> {
  for (let i = 0; i < ticks; i++) {
    await new Promise<void>((resolve) => process.nextTick(resolve));
  }
}

// ─── room:create ─────────────────────────────────────────────────────────────

describe('room:create', () => {
  it('방을 생성하고 roomId와 playerId를 반환한다', async () => {
    const socket = createClient();
    await waitConnect(socket);

    const data = await emitCb<{ room: { id: string; code: string }; playerId: string }>(
      socket,
      'room:create',
      { playerName: '호스트' },
    );

    expect(data.room.id).toBeDefined();
    expect(data.room.code).toHaveLength(6);
    expect(data.playerId).toBeDefined();

    socket.disconnect();
  });

  it('생성한 방에서 호스트 플레이어가 정상적으로 설정된다', async () => {
    const socket = createClient();
    await waitConnect(socket);

    const data = await emitCb<{
      room: { hostId: string; players: Array<{ id: string; isHost: boolean }> };
      playerId: string;
    }>(socket, 'room:create', { playerName: '방장' });

    expect(data.room.hostId).toBe(data.playerId);
    expect(data.room.players[0].isHost).toBe(true);

    socket.disconnect();
  });
});

// ─── room:join ────────────────────────────────────────────────────────────────

describe('room:join', () => {
  it('방 코드로 입장하면 playerId와 room을 반환한다', async () => {
    const host = createClient();
    await waitConnect(host);
    const hostData = await emitCb<{ room: { id: string; code: string }; playerId: string }>(
      host,
      'room:create',
      { playerName: '호스트' },
    );
    const roomCode = hostData.room.code;

    const guest = createClient();
    await waitConnect(guest);
    const guestData = await emitCb<{
      room: { players: Array<{ name: string }> };
      playerId: string;
    }>(guest, 'room:join', { roomCode, playerName: '게스트' });

    expect(guestData.playerId).toBeDefined();
    expect(guestData.room.players.length).toBe(2);

    host.disconnect();
    guest.disconnect();
  });

  it('존재하지 않는 방 코드로 입장 시 에러를 반환한다', async () => {
    const socket = createClient();
    await waitConnect(socket);

    await expect(
      emitCb(socket, 'room:join', { roomCode: 'XXXXXX', playerName: '참가자' }),
    ).rejects.toThrow('방을 찾을 수 없습니다.');

    socket.disconnect();
  });

  it('AI 이름과 동일한 닉네임으로 입장 시 에러를 반환한다', async () => {
    const host = createClient();
    await waitConnect(host);
    const hostData = await emitCb<{ room: { id: string; code: string } }>(
      host,
      'room:create',
      { playerName: '호스트' },
    );

    // AI 추가 (AI 이름: 'AI 알파')
    await emitCb(host, 'room:add_ai', { roomId: hostData.room.id });

    const guest = createClient();
    await waitConnect(guest);
    // 'AI 알파'는 AI 플레이어 이름이므로 reconnect 처리되지 않고 에러 발생
    await expect(
      emitCb(guest, 'room:join', { roomCode: hostData.room.code, playerName: 'AI 알파' }),
    ).rejects.toThrow('이미 사용 중인 닉네임입니다.');

    host.disconnect();
    guest.disconnect();
  });

  it('입장 시 room:player_joined 이벤트가 호스트에게 전달된다', async () => {
    const host = createClient();
    await waitConnect(host);
    const hostData = await emitCb<{ room: { code: string } }>(
      host,
      'room:create',
      { playerName: '호스트' },
    );

    const joinedPromise = waitEvent<{ player: { name: string } }>(host, 'room:player_joined');

    const guest = createClient();
    await waitConnect(guest);
    await emitCb(guest, 'room:join', { roomCode: hostData.room.code, playerName: '게스트' });

    const joined = await joinedPromise;
    expect(joined.player.name).toBe('게스트');

    host.disconnect();
    guest.disconnect();
  });

  it('소문자 코드로도 입장할 수 있다', async () => {
    const host = createClient();
    await waitConnect(host);
    const hostData = await emitCb<{ room: { code: string } }>(
      host,
      'room:create',
      { playerName: '호스트' },
    );

    const guest = createClient();
    await waitConnect(guest);
    const guestData = await emitCb<{ room: { players: unknown[] } }>(
      guest,
      'room:join',
      { roomCode: hostData.room.code.toLowerCase(), playerName: '게스트' },
    );

    expect(guestData.room.players.length).toBe(2);

    host.disconnect();
    guest.disconnect();
  });
});

// ─── room:add_ai ─────────────────────────────────────────────────────────────

describe('room:add_ai', () => {
  it('호스트가 AI 플레이어를 추가할 수 있다', async () => {
    const host = createClient();
    await waitConnect(host);
    const hostData = await emitCb<{ room: { id: string } }>(
      host,
      'room:create',
      { playerName: '호스트' },
    );
    const roomId = hostData.room.id;

    const data = await emitCb<{ player: { isAI: boolean; isReady: boolean } }>(
      host,
      'room:add_ai',
      { roomId },
    );

    expect(data.player.isAI).toBe(true);
    expect(data.player.isReady).toBe(true);
    expect(getRoom(roomId)?.players.length).toBe(2);

    host.disconnect();
  });

  it('비호스트가 AI 추가 시도 시 에러를 반환한다', async () => {
    const host = createClient();
    await waitConnect(host);
    const hostData = await emitCb<{ room: { id: string; code: string } }>(
      host,
      'room:create',
      { playerName: '호스트' },
    );

    const guest = createClient();
    await waitConnect(guest);
    await emitCb(guest, 'room:join', {
      roomCode: hostData.room.code,
      playerName: '게스트',
    });

    await expect(
      emitCb(guest, 'room:add_ai', { roomId: hostData.room.id }),
    ).rejects.toThrow('호스트만 AI를 추가할 수 있습니다.');

    host.disconnect();
    guest.disconnect();
  });

  it('존재하지 않는 방에 AI 추가 시 에러를 반환한다', async () => {
    const socket = createClient();
    await waitConnect(socket);
    await emitCb(socket, 'room:create', { playerName: '호스트' });

    await expect(
      emitCb(socket, 'room:add_ai', { roomId: 'non-existent-room-id' }),
    ).rejects.toThrow('방을 찾을 수 없습니다.');

    socket.disconnect();
  });
});

// ─── room:update_settings ────────────────────────────────────────────────────

describe('room:update_settings', () => {
  it('호스트가 설정을 업데이트할 수 있다', async () => {
    const host = createClient();
    await waitConnect(host);
    const hostData = await emitCb<{ room: { id: string } }>(
      host,
      'room:create',
      { playerName: '호스트' },
    );
    const roomId = hostData.room.id;

    await emitCb(host, 'room:update_settings', {
      roomId,
      settings: { mode: 'fool', category: 'animal' },
    });

    await drainEventLoop();
    const room = getRoom(roomId);
    expect(room?.settings.mode).toBe('fool');
    expect(room?.settings.category).toBe('animal');

    host.disconnect();
  });

  it('비호스트가 설정 변경 시도 시 에러를 반환한다', async () => {
    const host = createClient();
    await waitConnect(host);
    const hostData = await emitCb<{ room: { id: string; code: string } }>(
      host,
      'room:create',
      { playerName: '호스트' },
    );

    const guest = createClient();
    await waitConnect(guest);
    await emitCb(guest, 'room:join', {
      roomCode: hostData.room.code,
      playerName: '게스트',
    });

    await expect(
      emitCb(guest, 'room:update_settings', {
        roomId: hostData.room.id,
        settings: { mode: 'fool' },
      }),
    ).rejects.toThrow('호스트만 설정을 변경할 수 있습니다.');

    host.disconnect();
    guest.disconnect();
  });

  it('설정 변경 시 room:updated 이벤트가 브로드캐스트된다', async () => {
    const host = createClient();
    await waitConnect(host);
    const hostData = await emitCb<{ room: { id: string } }>(
      host,
      'room:create',
      { playerName: '호스트' },
    );
    const roomId = hostData.room.id;

    const updatedPromise = waitEvent<{ room: { settings: { category: string } } }>(
      host,
      'room:updated',
    );

    await emitCb(host, 'room:update_settings', {
      roomId,
      settings: { category: 'food' },
    });

    const updated = await updatedPromise;
    expect(updated.room.settings.category).toBe('food');

    host.disconnect();
  });
});

// ─── room:start ──────────────────────────────────────────────────────────────

describe('room:start', () => {
  it('호스트가 게임을 시작하면 role_reveal 페이즈로 전환된다', async () => {
    const host = createClient();
    await waitConnect(host);
    const hostData = await emitCb<{ room: { id: string } }>(
      host,
      'room:create',
      { playerName: '호스트' },
    );
    const roomId = hostData.room.id;

    // AI 추가 (최소 2명)
    await emitCb(host, 'room:add_ai', { roomId });
    await emitCb(host, 'room:update_settings', {
      roomId,
      settings: { category: 'food' },
    });

    const phaseChangePromise = waitEvent<{ phase: string }>(host, 'game:phase_change');

    await emitCb(host, 'room:start', { roomId });

    const phaseChange = await phaseChangePromise;
    expect(phaseChange.phase).toBe('role_reveal');

    host.disconnect();
  });

  it('카테고리가 없으면 시작할 수 없다', async () => {
    const host = createClient();
    await waitConnect(host);
    const hostData = await emitCb<{ room: { id: string } }>(
      host,
      'room:create',
      { playerName: '호스트' },
    );
    const roomId = hostData.room.id;
    await emitCb(host, 'room:add_ai', { roomId });
    // 카테고리 미설정

    await expect(emitCb(host, 'room:start', { roomId })).rejects.toThrow(
      '카테고리를 선택해 주세요.',
    );

    host.disconnect();
  });

  it('플레이어가 1명이면 시작할 수 없다', async () => {
    const host = createClient();
    await waitConnect(host);
    const hostData = await emitCb<{ room: { id: string } }>(
      host,
      'room:create',
      { playerName: '호스트' },
    );
    const roomId = hostData.room.id;
    await emitCb(host, 'room:update_settings', {
      roomId,
      settings: { category: 'food' },
    });

    await expect(emitCb(host, 'room:start', { roomId })).rejects.toThrow('최소 2명이 필요합니다.');

    host.disconnect();
  });

  it('비호스트는 게임을 시작할 수 없다', async () => {
    const host = createClient();
    await waitConnect(host);
    const hostData = await emitCb<{ room: { id: string; code: string } }>(
      host,
      'room:create',
      { playerName: '호스트' },
    );
    const roomId = hostData.room.id;
    await emitCb(host, 'room:add_ai', { roomId });
    await emitCb(host, 'room:update_settings', {
      roomId,
      settings: { category: 'food' },
    });

    const guest = createClient();
    await waitConnect(guest);
    await emitCb(guest, 'room:join', {
      roomCode: hostData.room.code,
      playerName: '게스트',
    });

    await expect(emitCb(guest, 'room:start', { roomId })).rejects.toThrow(
      '호스트만 게임을 시작할 수 있습니다.',
    );

    host.disconnect();
    guest.disconnect();
  });
});

// ─── game:send_message ────────────────────────────────────────────────────────

describe('game:send_message', () => {
  it('토론 단계에서 메시지를 보낼 수 있다', async () => {
    const host = createClient();
    await waitConnect(host);
    const hostData = await emitCb<{ room: { id: string }; playerId: string }>(
      host,
      'room:create',
      { playerName: '호스트' },
    );
    const roomId = hostData.room.id;

    // 토론 단계로 설정
    const room = getRoom(roomId)!;
    room.phase = 'discussion';

    const data = await emitCb<{ message: { text: string; isAI: boolean } }>(
      host,
      'game:send_message',
      { roomId, text: '저는 2번이 의심됩니다.' },
    );

    expect(data.message.text).toBe('저는 2번이 의심됩니다.');
    expect(data.message.isAI).toBe(false);

    host.disconnect();
  });

  it('토론 단계가 아니면 메시지를 보낼 수 없다', async () => {
    const host = createClient();
    await waitConnect(host);
    const hostData = await emitCb<{ room: { id: string } }>(
      host,
      'room:create',
      { playerName: '호스트' },
    );
    const roomId = hostData.room.id;
    // 대기 단계 (기본)

    await expect(
      emitCb(host, 'game:send_message', { roomId, text: '메시지' }),
    ).rejects.toThrow('토론 단계가 아닙니다.');

    host.disconnect();
  });

  it('메시지 전송 시 room 멤버에게 game:message_received 이벤트가 전달된다', async () => {
    const host = createClient();
    await waitConnect(host);
    const hostData = await emitCb<{ room: { id: string; code: string }; playerId: string }>(
      host,
      'room:create',
      { playerName: '호스트' },
    );
    const roomId = hostData.room.id;

    const guest = createClient();
    await waitConnect(guest);
    await emitCb(guest, 'room:join', {
      roomCode: hostData.room.code,
      playerName: '게스트',
    });

    // 토론 단계 설정
    const room = getRoom(roomId)!;
    room.phase = 'discussion';

    const msgPromise = waitEvent<{ message: { text: string } }>(guest, 'game:message_received');
    await emitCb(host, 'game:send_message', { roomId, text: '안녕하세요' });

    const received = await msgPromise;
    expect(received.message.text).toBe('안녕하세요');

    host.disconnect();
    guest.disconnect();
  });
});

// ─── game:submit_vote ─────────────────────────────────────────────────────────

describe('game:submit_vote', () => {
  it('투표 단계에서 투표할 수 있다', async () => {
    const host = createClient();
    await waitConnect(host);
    const hostData = await emitCb<{ room: { id: string }; playerId: string }>(
      host,
      'room:create',
      { playerName: '호스트' },
    );
    const roomId = hostData.room.id;

    // AI 추가하여 투표 대상 생성
    const aiData = await emitCb<{ player: { id: string } }>(
      host,
      'room:add_ai',
      { roomId },
    );

    // 게임 시작 필요 (liarId 설정)
    const room = getRoom(roomId)!;
    room.phase = 'vote';
    room.liarId = aiData.player.id;
    room.votes = [];

    await expect(
      emitCb(host, 'game:submit_vote', { roomId, targetId: aiData.player.id }),
    ).resolves.not.toThrow();

    await drainEventLoop();
    expect(getRoom(roomId)?.votes.length).toBe(1);
    expect(getRoom(roomId)?.votes[0].targetId).toBe(aiData.player.id);

    host.disconnect();
  });

  it('투표 단계가 아니면 투표할 수 없다', async () => {
    const host = createClient();
    await waitConnect(host);
    const hostData = await emitCb<{ room: { id: string } }>(
      host,
      'room:create',
      { playerName: '호스트' },
    );
    const roomId = hostData.room.id;
    const aiData = await emitCb<{ player: { id: string } }>(
      host,
      'room:add_ai',
      { roomId },
    );

    // 대기 단계 (기본)
    await expect(
      emitCb(host, 'game:submit_vote', { roomId, targetId: aiData.player.id }),
    ).rejects.toThrow('투표 단계가 아닙니다.');

    host.disconnect();
  });

  it('중복 투표 시 에러를 반환하고 투표수가 1개를 유지한다', async () => {
    const host = createClient();
    await waitConnect(host);
    const hostData = await emitCb<{ room: { id: string }; playerId: string }>(
      host,
      'room:create',
      { playerName: '호스트' },
    );
    const roomId = hostData.room.id;
    const aiData = await emitCb<{ player: { id: string } }>(
      host,
      'room:add_ai',
      { roomId },
    );

    const room = getRoom(roomId)!;
    room.phase = 'vote';
    room.liarId = aiData.player.id;
    room.votes = [];

    // 첫 번째 투표 (성공)
    await emitCb(host, 'game:submit_vote', { roomId, targetId: aiData.player.id });
    await drainEventLoop();
    expect(getRoom(roomId)?.votes.length).toBe(1);

    // 두 번째 투표 시도 → 에러 반환
    await expect(
      emitCb(host, 'game:submit_vote', { roomId, targetId: aiData.player.id }),
    ).rejects.toThrow('이미 투표했습니다.');

    // 투표수는 여전히 1개
    expect(getRoom(roomId)?.votes.length).toBe(1);

    host.disconnect();
  });
});

// ─── room:play_again ─────────────────────────────────────────────────────────

describe('room:play_again', () => {
  it('결과 단계에서 다시 하기가 가능하다', async () => {
    const host = createClient();
    await waitConnect(host);
    const hostData = await emitCb<{ room: { id: string }; playerId: string }>(
      host,
      'room:create',
      { playerName: '호스트' },
    );
    const roomId = hostData.room.id;

    // 결과 단계로 설정
    const room = getRoom(roomId)!;
    room.phase = 'result';

    await emitCb(host, 'room:play_again', { roomId });
    await drainEventLoop();

    expect(getRoom(roomId)?.phase).toBe('waiting');

    host.disconnect();
  });

  it('결과 단계가 아니면 다시 하기를 할 수 없다', async () => {
    const host = createClient();
    await waitConnect(host);
    const hostData = await emitCb<{ room: { id: string } }>(
      host,
      'room:create',
      { playerName: '호스트' },
    );
    const roomId = hostData.room.id;
    // 대기 단계 (기본)

    await expect(emitCb(host, 'room:play_again', { roomId })).rejects.toThrow(
      '결과 화면에서만 가능합니다.',
    );

    host.disconnect();
  });
});

// ─── disconnect ───────────────────────────────────────────────────────────────

describe('disconnect', () => {
  it('대기 단계에서 플레이어 퇴장 시 방에서 제거된다', async () => {
    const host = createClient();
    await waitConnect(host);
    const hostData = await emitCb<{ room: { id: string; code: string }; playerId: string }>(
      host,
      'room:create',
      { playerName: '호스트' },
    );
    const roomId = hostData.room.id;

    const guest = createClient();
    await waitConnect(guest);
    await emitCb(guest, 'room:join', {
      roomCode: hostData.room.code,
      playerName: '게스트',
    });

    expect(getRoom(roomId)?.players.length).toBe(2);

    // room:player_left 이벤트 수신을 기다림
    const playerLeftPromise = waitEvent<{ playerId: string }>(host, 'room:player_left');
    guest.disconnect();
    await playerLeftPromise;

    expect(getRoom(roomId)?.players.length).toBe(1);

    host.disconnect();
  });

  it('마지막 플레이어가 퇴장하면 방이 삭제된다', async () => {
    const host = createClient();
    await waitConnect(host);
    const hostData = await emitCb<{ room: { id: string } }>(
      host,
      'room:create',
      { playerName: '호스트' },
    );
    const roomId = hostData.room.id;

    // 연결 해제 후 서버 처리 대기
    await new Promise<void>((resolve) => {
      host.on('disconnect', () => setTimeout(resolve, 100));
      host.disconnect();
    });

    expect(getRoom(roomId)).toBeUndefined();
  });

  it('게임 진행 중 퇴장하면 연결 끊김 상태로 표시된다', async () => {
    const host = createClient();
    await waitConnect(host);
    const hostData = await emitCb<{ room: { id: string; code: string }; playerId: string }>(
      host,
      'room:create',
      { playerName: '호스트' },
    );
    const roomId = hostData.room.id;

    const guest = createClient();
    await waitConnect(guest);
    const guestData = await emitCb<{ playerId: string }>(guest, 'room:join', {
      roomCode: hostData.room.code,
      playerName: '게스트',
    });

    // 게임 진행 중으로 변경
    const room = getRoom(roomId)!;
    room.phase = 'discussion';

    // room:updated 이벤트로 연결 끊김 감지
    const updatedPromise = waitEvent<{ room: { players: Array<{ id: string; isConnected: boolean }> } }>(
      host,
      'room:updated',
    );
    guest.disconnect();
    const updated = await updatedPromise;

    const disconnectedPlayer = updated.room.players.find((p) => p.id === guestData.playerId);
    expect(disconnectedPlayer?.isConnected).toBe(false);

    host.disconnect();
  });
});
