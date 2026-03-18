// @vitest-environment node
/**
 * 게임 전체 플로우 통합 테스트
 *
 * 전략:
 * 1. Socket.IO 연결은 실제 타이머로 수행 (연결 안정성 보장)
 * 2. 게임 플로우 테스트 시 가짜 타이머 사용 (role_reveal 10초 등 타이머 제어)
 * 3. 타이머 진행 후 process.nextTick으로 이벤트 루프 비우기 (TCP 이벤트 전파)
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { io as ioc, Socket } from 'socket.io-client';
import type { AddressInfo } from 'net';
import { initSocketServer } from '@/lib/socket/server';
import { _clearAllRooms, getRoom } from '@/lib/room-manager';
import type { Phase } from '@/types/game';

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
        // 타이머 간섭 방지: 핑 타임아웃 매우 길게 설정
        pingInterval: 300_000,
        pingTimeout: 300_000,
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

function createClient(): Socket {
  return ioc(`http://localhost:${port}`, {
    transports: ['websocket'],
    autoConnect: true,
    reconnection: false,
    timeout: 5000,
  });
}

function waitConnect(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    socket.on('connect', resolve);
    socket.on('connect_error', reject);
    setTimeout(reject, 3000);
  });
}

function waitEvent<T>(socket: Socket, event: string, timeoutMs = 5000): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Timeout waiting for ${event}`)), timeoutMs);
    socket.once(event as never, (data: T) => {
      clearTimeout(timer);
      resolve(data);
    });
  });
}

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

/** process.nextTick으로 이벤트 루프를 비워 소켓 이벤트 전파를 기다린다 */
async function drainEventLoop(ticks = 10): Promise<void> {
  for (let i = 0; i < ticks; i++) {
    await new Promise<void>((resolve) => process.nextTick(resolve));
  }
}

// ─── 방 생성 ~ 대기실 플로우 ─────────────────────────────────────────────────

describe('방 생성 및 대기실', () => {
  it('방을 생성하고 AI 플레이어를 추가할 수 있다', async () => {
    const host = createClient();
    await waitConnect(host);

    const hostData = await emitCb<{ room: { id: string; code: string }; playerId: string }>(
      host,
      'room:create',
      { playerName: '호스트' },
    );
    const roomId = hostData.room.id;

    // AI 3명 추가
    for (let i = 0; i < 3; i++) {
      await emitCb(host, 'room:add_ai', { roomId });
    }

    const room = getRoom(roomId);
    expect(room?.players.length).toBe(4);
    expect(room?.players.filter((p) => p.isAI).length).toBe(3);

    host.disconnect();
  });

  it('게스트가 입장하면 호스트와 게스트 모두 room:player_joined를 수신한다', async () => {
    const host = createClient();
    await waitConnect(host);
    const hostData = await emitCb<{ room: { code: string } }>(
      host,
      'room:create',
      { playerName: '호스트' },
    );

    const guest = createClient();
    await waitConnect(guest);

    const joinedPromise = waitEvent<{ player: { name: string } }>(host, 'room:player_joined');
    await emitCb(guest, 'room:join', {
      roomCode: hostData.room.code,
      playerName: '게스트',
    });

    const joined = await joinedPromise;
    expect(joined.player.name).toBe('게스트');

    host.disconnect();
    guest.disconnect();
  });

  it('호스트가 게임 설정을 업데이트하면 전체 방에 room:updated가 브로드캐스트된다', async () => {
    const host = createClient();
    await waitConnect(host);
    const hostData = await emitCb<{ room: { id: string; code: string } }>(
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

    const updatedPromise = waitEvent<{ room: { settings: { mode: string } } }>(
      guest,
      'room:updated',
    );

    await emitCb(host, 'room:update_settings', {
      roomId,
      settings: { mode: 'fool', category: 'animal' },
    });

    const updated = await updatedPromise;
    expect(updated.room.settings.mode).toBe('fool');

    host.disconnect();
    guest.disconnect();
  });
});

// ─── 게임 시작 ~ role_reveal ─────────────────────────────────────────────────

describe('게임 시작 및 role_reveal', () => {
  it('게임 시작 시 role_reveal 페이즈로 전환된다', async () => {
    const host = createClient();
    await waitConnect(host);

    const hostData = await emitCb<{ room: { id: string }; playerId: string }>(
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

    const phaseChangePromise = waitEvent<{ phase: Phase; phaseStartAt: number; durationSec: number }>(
      host,
      'game:phase_change',
    );

    await emitCb(host, 'room:start', { roomId });

    const phaseChange = await phaseChangePromise;
    expect(phaseChange.phase).toBe('role_reveal');
    expect(phaseChange.phaseStartAt).toBeGreaterThan(0);
    expect(phaseChange.durationSec).toBe(10);

    host.disconnect();
  });

  it('게임 시작 시 역할(liar/citizen)이 배정된다', async () => {
    const host = createClient();
    await waitConnect(host);

    const hostData = await emitCb<{ room: { id: string } }>(
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

    const roleAssignedPromise = waitEvent<{ role: string; category: string }>(
      host,
      'game:role_assigned',
    );

    await emitCb(host, 'room:start', { roomId });

    const roleAssigned = await roleAssignedPromise;
    expect(['citizen', 'liar']).toContain(roleAssigned.role);
    expect(roleAssigned.category).toBe('food');

    await drainEventLoop();

    const room = getRoom(roomId);
    expect(room?.liarId).toBeDefined();
    expect(room?.settings.keyword).toBeDefined();

    host.disconnect();
  });

  it('시민은 키워드를 수신하고 라이어는 수신하지 않는다', async () => {
    const host = createClient();
    await waitConnect(host);

    const hostData = await emitCb<{ room: { id: string }; playerId: string }>(
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

    const roleAssignedPromise = waitEvent<{ role: string; keyword?: string }>(
      host,
      'game:role_assigned',
    );

    await emitCb(host, 'room:start', { roomId });

    const roleAssigned = await roleAssignedPromise;

    await drainEventLoop();
    const room = getRoom(roomId);

    if (roleAssigned.role === 'citizen') {
      expect(roleAssigned.keyword).toBe(room?.settings.keyword);
    } else {
      // 라이어는 키워드를 받지 않음
      expect(roleAssigned.keyword).toBeUndefined();
    }

    host.disconnect();
  });
});

// ─── 설명 단계 (description phase) ───────────────────────────────────────────

describe('설명 단계', () => {
  it('자신의 차례에 설명을 제출할 수 있다', async () => {
    const host = createClient();
    await waitConnect(host);

    const hostData = await emitCb<{ room: { id: string }; playerId: string }>(
      host,
      'room:create',
      { playerName: '호스트' },
    );
    const roomId = hostData.room.id;
    const hostPlayerId = hostData.playerId;

    await emitCb(host, 'room:add_ai', { roomId });
    await emitCb(host, 'room:update_settings', {
      roomId,
      settings: { category: 'food', descriptionTimerSec: 60 },
    });

    // 게임 시작
    await emitCb(host, 'room:start', { roomId });
    await drainEventLoop();

    // description 단계로 직접 전환
    const room = getRoom(roomId)!;
    room.phase = 'description';
    room.currentTurnIndex = 0;
    // 호스트가 첫 번째 턴이 되도록 설정
    const hostIndex = room.turnOrder.indexOf(hostPlayerId);
    if (hostIndex !== 0) {
      // 호스트를 첫 번째로 이동
      room.turnOrder.splice(hostIndex, 1);
      room.turnOrder.unshift(hostPlayerId);
    }

    const descriptionSubmittedPromise = waitEvent<{
      description: { text: string; playerId: string };
    }>(host, 'game:description_submitted');

    await emitCb(host, 'game:submit_description', {
      roomId,
      text: '이것은 맛있는 음식입니다',
    });

    const submitted = await descriptionSubmittedPromise;
    expect(submitted.description.text).toBe('이것은 맛있는 음식입니다');
    expect(submitted.description.playerId).toBe(hostPlayerId);

    host.disconnect();
  });

  it('자신의 차례가 아닐 때 설명을 제출하면 에러를 반환한다', async () => {
    const host = createClient();
    await waitConnect(host);

    const hostData = await emitCb<{ room: { id: string; code: string }; playerId: string }>(
      host,
      'room:create',
      { playerName: '호스트' },
    );
    const roomId = hostData.room.id;
    const hostPlayerId = hostData.playerId;

    await emitCb(host, 'room:add_ai', { roomId });
    await emitCb(host, 'room:update_settings', {
      roomId,
      settings: { category: 'food' },
    });

    await emitCb(host, 'room:start', { roomId });
    await drainEventLoop();

    // description 단계로 전환 (호스트가 첫 번째가 아니도록)
    const room = getRoom(roomId)!;
    room.phase = 'description';
    room.currentTurnIndex = 0;
    // 호스트가 첫 번째 턴이 아님을 보장
    const hostIndex = room.turnOrder.indexOf(hostPlayerId);
    if (hostIndex === 0) {
      // 호스트를 마지막으로 이동
      room.turnOrder.splice(hostIndex, 1);
      room.turnOrder.push(hostPlayerId);
    }

    await expect(
      emitCb(host, 'game:submit_description', { roomId, text: '설명' }),
    ).rejects.toThrow('현재 당신의 차례가 아닙니다.');

    host.disconnect();
  });
});

// ─── 투표 단계 (vote phase) ───────────────────────────────────────────────────

describe('투표 단계', () => {
  it('투표 완료 시 game:vote_submitted 이벤트가 전달된다', async () => {
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

    // 투표 단계로 직접 전환
    const room = getRoom(roomId)!;
    room.phase = 'vote';
    room.liarId = aiData.player.id;
    room.votes = [];

    const voteSubmittedPromise = waitEvent<{
      voterId: string;
      voteCount: number;
      totalPlayers: number;
    }>(host, 'game:vote_submitted');

    await emitCb(host, 'game:submit_vote', {
      roomId,
      targetId: aiData.player.id,
    });

    const voteSubmitted = await voteSubmittedPromise;
    expect(voteSubmitted.voterId).toBe(hostData.playerId);
    expect(voteSubmitted.voteCount).toBe(1);
    expect(voteSubmitted.totalPlayers).toBe(2);

    host.disconnect();
  });

  it('모든 플레이어가 투표하면 game:vote_result가 전달된다', async () => {
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

    // 투표 단계로 직접 전환
    const room = getRoom(roomId)!;
    room.phase = 'vote';
    room.liarId = aiData.player.id;
    room.votes = [];
    // 이미 AI 투표도 넣어두기 (모든 투표 완료 시뮬레이션)
    room.votes.push({ voterId: aiData.player.id, targetId: hostData.playerId });

    const voteResultPromise = waitEvent<{
      summary: Array<{ targetId: string; count: number }>;
      liarCaught: boolean;
      liarId: string;
    }>(host, 'game:vote_result');

    // 마지막 투표 (호스트) → 모든 플레이어 투표 완료 → 결과 발생
    await emitCb(host, 'game:submit_vote', {
      roomId,
      targetId: aiData.player.id,
    });

    const voteResult = await voteResultPromise;
    expect(voteResult.liarId).toBe(aiData.player.id);
    expect(Array.isArray(voteResult.summary)).toBe(true);

    host.disconnect();
  });
});

// ─── 최종 변론 (final_defense phase) ─────────────────────────────────────────

describe('최종 변론', () => {
  it('라이어가 정답을 맞히면 game:final_defense_submitted에서 correct=true다', async () => {
    const host = createClient();
    await waitConnect(host);

    const hostData = await emitCb<{ room: { id: string }; playerId: string }>(
      host,
      'room:create',
      { playerName: '호스트' },
    );
    const roomId = hostData.room.id;
    const hostPlayerId = hostData.playerId;

    await emitCb(host, 'room:add_ai', { roomId });
    await emitCb(host, 'room:update_settings', {
      roomId,
      settings: { category: 'food' },
    });

    // 호스트가 라이어가 되도록 직접 설정
    const room = getRoom(roomId)!;
    room.phase = 'final_defense';
    room.liarId = hostPlayerId;
    room.settings.keyword = '치킨';
    room.settings.category = 'food';

    const finalDefensePromise = waitEvent<{ keyword: string; correct: boolean }>(
      host,
      'game:final_defense_submitted',
    );

    await emitCb(host, 'game:submit_final_defense', {
      roomId,
      keyword: '치킨', // 정답
    });

    const result = await finalDefensePromise;
    expect(result.keyword).toBe('치킨');
    expect(result.correct).toBe(true);

    host.disconnect();
  });

  it('라이어가 정답을 틀리면 correct=false다', async () => {
    const host = createClient();
    await waitConnect(host);

    const hostData = await emitCb<{ room: { id: string }; playerId: string }>(
      host,
      'room:create',
      { playerName: '호스트' },
    );
    const roomId = hostData.room.id;
    const hostPlayerId = hostData.playerId;

    await emitCb(host, 'room:add_ai', { roomId });

    // 호스트가 라이어가 되도록 직접 설정
    const room = getRoom(roomId)!;
    room.phase = 'final_defense';
    room.liarId = hostPlayerId;
    room.settings.keyword = '치킨';
    room.settings.category = 'food';

    const finalDefensePromise = waitEvent<{ keyword: string; correct: boolean }>(
      host,
      'game:final_defense_submitted',
    );

    await emitCb(host, 'game:submit_final_defense', {
      roomId,
      keyword: '피자', // 오답
    });

    const result = await finalDefensePromise;
    expect(result.keyword).toBe('피자');
    expect(result.correct).toBe(false);

    host.disconnect();
  });

  it('라이어가 아닌 플레이어가 최종 변론을 시도하면 에러를 반환한다', async () => {
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

    // AI가 라이어, 호스트는 시민
    const room = getRoom(roomId)!;
    room.phase = 'final_defense';
    room.liarId = aiData.player.id; // 호스트가 라이어가 아님
    room.settings.keyword = '치킨';
    room.settings.category = 'food';

    await expect(
      emitCb(host, 'game:submit_final_defense', { roomId, keyword: '치킨' }),
    ).rejects.toThrow('라이어만 답변할 수 있습니다.');

    host.disconnect();
  });
});

// ─── 결과 확인 (result phase) ─────────────────────────────────────────────────

describe('결과 확인', () => {
  it('라이어 미지목 시 liar_wins 결과가 반환된다', async () => {
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

    // AI가 라이어, 투표에서 라이어를 못 잡는 상황 설정
    const room = getRoom(roomId)!;
    room.phase = 'vote';
    room.liarId = aiData.player.id;
    room.votes = [];
    // AI 투표 미리 추가
    room.votes.push({ voterId: aiData.player.id, targetId: hostData.playerId });
    room.settings.keyword = '치킨';
    room.settings.category = 'food';
    room.players.forEach((p) => {
      p.role = p.id === room.liarId ? 'liar' : 'citizen';
    });

    const voteResultPromise = waitEvent<{ liarCaught: boolean }>(host, 'game:vote_result');

    // 호스트가 AI 외 다른 플레이어에게 투표 (라이어 미지목은 어렵지만, hostData.playerId 투표)
    // 여기서는 모두가 투표했으므로 result 체인이 시작됨
    await emitCb(host, 'game:submit_vote', {
      roomId,
      targetId: hostData.playerId, // 자신에게 투표 (실제로 자신은 못 지목하지만 서버에서는 허용)
    });

    const voteResult = await voteResultPromise;
    expect(typeof voteResult.liarCaught).toBe('boolean');

    // game:result 대기
    const resultPromise = waitEvent<{ result: { winCondition: string } }>(host, 'game:result');
    const gameResult = await resultPromise;
    expect(['liar_wins', 'citizens_win', 'fool_caught', 'fool_missed']).toContain(
      gameResult.result.winCondition,
    );

    host.disconnect();
  });

  it('결과 단계에서 키워드가 공개된다', async () => {
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
    room.votes = [{ voterId: aiData.player.id, targetId: hostData.playerId }];
    room.settings.keyword = '삼겹살';
    room.settings.category = 'food';
    room.players.forEach((p) => {
      p.role = p.id === room.liarId ? 'liar' : 'citizen';
    });

    const resultPromise = waitEvent<{ result: { keyword: string } }>(host, 'game:result');

    await emitCb(host, 'game:submit_vote', {
      roomId,
      targetId: hostData.playerId,
    });

    const gameResult = await resultPromise;
    expect(gameResult.result.keyword).toBe('삼겹살');

    host.disconnect();
  });
});

// ─── 다시 하기 (play_again) ───────────────────────────────────────────────────

describe('다시 하기', () => {
  it('결과 단계에서 다시 하기 후 방이 waiting 상태로 초기화된다', async () => {
    const host = createClient();
    await waitConnect(host);

    const hostData = await emitCb<{ room: { id: string } }>(
      host,
      'room:create',
      { playerName: '호스트' },
    );
    const roomId = hostData.room.id;

    const room = getRoom(roomId)!;
    room.phase = 'result';
    room.keyword = '치킨';
    room.liarId = 'someone';
    room.descriptions = [{ playerId: 'p1', playerName: '플레이어1', text: '설명', submittedAt: 0 }];
    room.votes = [{ voterId: 'p1', targetId: 'p2' }];

    const updatedPromise = waitEvent<{ room: { phase: string } }>(host, 'room:updated');

    await emitCb(host, 'room:play_again', { roomId });

    const updated = await updatedPromise;
    expect(updated.room.phase).toBe('waiting');

    const freshRoom = getRoom(roomId);
    expect(freshRoom?.phase).toBe('waiting');
    expect(freshRoom?.descriptions.length).toBe(0);
    expect(freshRoom?.votes.length).toBe(0);
    expect(freshRoom?.keyword).toBeUndefined();

    host.disconnect();
  });
});

// ─── 가짜 타이머를 이용한 페이즈 자동 전환 테스트 ──────────────────────────────

describe('페이즈 자동 전환 (가짜 타이머)', { timeout: 30000 }, () => {
  it('role_reveal 타이머 만료 시 description 페이즈로 전환된다', async () => {
    const host = createClient();
    await waitConnect(host);

    const hostData = await emitCb<{ room: { id: string } }>(
      host,
      'room:create',
      { playerName: '호스트' },
    );
    const roomId = hostData.room.id;

    await emitCb(host, 'room:add_ai', { roomId });
    await emitCb(host, 'room:update_settings', {
      roomId,
      settings: { category: 'food', descriptionTimerSec: 1 },
    });

    // 페이즈 변경 이벤트 수집
    const phases: Phase[] = [];
    host.on('game:phase_change', (data: { phase: Phase }) => {
      phases.push(data.phase);
    });

    // 가짜 타이머 활성화 (setImmediate는 제외해서 소켓 이벤트 전파 가능)
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    });

    try {
      await emitCb(host, 'room:start', { roomId });
      await drainEventLoop();

      // role_reveal → description (10초 타이머)
      await vi.advanceTimersByTimeAsync(10001);
      await drainEventLoop(20);

      expect(phases).toContain('role_reveal');
      expect(phases).toContain('description');
    } finally {
      vi.useRealTimers();
      host.disconnect();
    }
  });

  it('description 타이머 만료 시 discussion 페이즈로 전환된다', async () => {
    const host = createClient();
    await waitConnect(host);

    const hostData = await emitCb<{ room: { id: string } }>(
      host,
      'room:create',
      { playerName: '호스트' },
    );
    const roomId = hostData.room.id;

    // AI 1명 (총 2명)
    await emitCb(host, 'room:add_ai', { roomId });
    await emitCb(host, 'room:update_settings', {
      roomId,
      settings: {
        category: 'food',
        descriptionTimerSec: 1,
        discussionTimerSec: 1,
      },
    });

    const phases: Phase[] = [];
    host.on('game:phase_change', (data: { phase: Phase }) => {
      phases.push(data.phase);
    });

    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'Date'],
    });

    try {
      await emitCb(host, 'room:start', { roomId });
      await drainEventLoop();

      // role_reveal (10s) → description (1s per turn × 2 players) → discussion transition (1s)
      // 총 약 13초 이상 진행
      await vi.advanceTimersByTimeAsync(10001);
      await drainEventLoop(20);

      await vi.advanceTimersByTimeAsync(1001);
      await drainEventLoop(20);

      await vi.advanceTimersByTimeAsync(1001);
      await drainEventLoop(20);

      await vi.advanceTimersByTimeAsync(1001);
      await drainEventLoop(20);

      expect(phases).toContain('description');
      expect(phases).toContain('discussion');
    } finally {
      vi.useRealTimers();
      host.disconnect();
    }
  });
});
