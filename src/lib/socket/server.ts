import { Server, Socket } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents, SocketData } from '@/types/socket-events';
import type { Room, Player, WinCondition, GameResult } from '@/types/game';
import {
  createRoom,
  joinRoom,
  getRoom,
  getRoomByCode,
  addAIPlayer,
  removePlayer,
} from '@/lib/room-manager';
import {
  assignRoles,
  selectKeyword,
  shuffleTurnOrder,
  tallyVotes,
  determineWinner,
} from '@/lib/game-logic';
import {
  generateAIDescription,
  generateAIMessage,
  generateAIVote,
  generateAIFinalAnswer,
} from '@/lib/ai/local-ai';
import { claudeKeywords, claudeCategoryAndKeywords } from '@/lib/ai/claude-ai';
import { getCategoryLabel } from '@/constants/categories';
import { generateId } from '@/lib/utils';

// ── 타입 별칭 ────────────────────────────────────────────────────────────────

// room:create는 타입 정의 외부 이벤트이므로 any 확장 허용
type ExtendedClientEvents = ClientToServerEvents & {
  'room:create': (
    payload: { playerName: string },
    callback: (res: { ok: boolean; data?: { room: Room; playerId: string }; error?: string }) => void,
  ) => void;
  'timer:sync': (
    payload: { roomId: string },
    callback: (res: { ok: boolean; data?: unknown; error?: string }) => void,
  ) => void;
};

type TypedIO = Server<ExtendedClientEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type TypedSocket = Socket<
  ExtendedClientEvents,
  ServerToClientEvents,
  Record<string, never>,
  SocketData
>;

// ── 서버 내부 상태 ────────────────────────────────────────────────────────────

/** playerId → socketId 매핑 (개인 이벤트 전송용) */
const playerSocketMap = new Map<string, string>();

/** roomId → 페이즈 타이머 */
const phaseTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** roomId → fool 모드 라이어 키워드 (게임 종료 시 삭제) */
const foolKeywords = new Map<string, string>();

// ── 타이머 헬퍼 ──────────────────────────────────────────────────────────────

function clearRoomTimer(roomId: string): void {
  const t = phaseTimers.get(roomId);
  if (t) {
    clearTimeout(t);
    phaseTimers.delete(roomId);
  }
}

function setRoomTimer(roomId: string, ms: number, cb: () => void): void {
  clearRoomTimer(roomId);
  phaseTimers.set(roomId, setTimeout(cb, ms));
}

// ── Room Sanitize (클라이언트 전송 전 민감 정보 제거) ─────────────────────────

/**
 * 클라이언트에 전송하기 전 room 객체를 sanitize합니다.
 * - keyword: result 단계에서만 공개
 * - settings.keyword: 항상 숨김
 * - player.role: 개인 이벤트(game:role_assigned)로만 전달
 */
function sanitizeRoom(room: Room): Room {
  return {
    ...room,
    keyword: room.phase === 'result' ? room.keyword : undefined,
    settings: {
      ...room.settings,
      keyword: undefined,
    },
    players: room.players.map((p) => {
      const sanitized = { ...p };
      delete sanitized.role;
      return sanitized;
    }),
  };
}

// ── 브로드캐스트 헬퍼 ────────────────────────────────────────────────────────

function broadcastRoomUpdate(io: TypedIO, room: Room): void {
  io.to(room.id).emit('room:updated', { room: sanitizeRoom(room) });
}

// ── 페이즈 전환 함수들 ────────────────────────────────────────────────────────

function startRoleReveal(io: TypedIO, room: Room): void {
  room.phase = 'role_reveal';
  room.phaseStartAt = Date.now();

  io.to(room.id).emit('game:phase_change', {
    phase: 'role_reveal',
    phaseStartAt: room.phaseStartAt,
    durationSec: 10,
  });

  // 각 플레이어에게 개인 역할 전달
  for (const player of room.players) {
    if (player.isAI) continue;
    const socketId = playerSocketMap.get(player.id);
    if (!socketId) continue;

    let keyword: string | undefined;
    if (player.role === 'citizen') {
      keyword = room.settings.keyword;
    } else if (player.role === 'liar' && room.settings.mode === 'fool') {
      // fool 모드: 라이어(바보)에게 다른 키워드 제공
      keyword = foolKeywords.get(room.id);
    }

    io.to(socketId).emit('game:role_assigned', {
      role: player.role!,
      keyword,
      category: room.settings.category,
    });
  }

  // 10초 후 description 단계로
  setRoomTimer(room.id, 10_000, () => {
    const fresh = getRoom(room.id);
    if (fresh?.phase === 'role_reveal') startDescription(io, fresh);
  });
}

function startDescription(io: TypedIO, room: Room): void {
  room.phase = 'description';
  room.currentTurnIndex = 0;
  room.phaseStartAt = Date.now();

  io.to(room.id).emit('game:phase_change', {
    phase: 'description',
    turnOrder: room.turnOrder,
    phaseStartAt: room.phaseStartAt,
    durationSec: room.settings.descriptionTimerSec,
  });

  advanceDescriptionTurn(io, room);
}

function advanceDescriptionTurn(io: TypedIO, room: Room): void {
  if (room.currentTurnIndex >= room.turnOrder.length) {
    // 모든 설명 완료 → discussion
    setTimeout(() => {
      const fresh = getRoom(room.id);
      if (fresh?.phase === 'description') startDiscussion(io, fresh);
    }, 1000);
    return;
  }

  const currentPlayerId = room.turnOrder[room.currentTurnIndex];
  const currentPlayer = room.players.find((p) => p.id === currentPlayerId);

  if (!currentPlayer) {
    room.currentTurnIndex++;
    advanceDescriptionTurn(io, room);
    return;
  }

  // 현재 플레이어에게 your_turn 알림
  const socketId = playerSocketMap.get(currentPlayerId);
  if (socketId && !currentPlayer.isAI) {
    io.to(socketId).emit('game:your_turn', {
      timeoutSec: room.settings.descriptionTimerSec,
    });
  }

  // 턴 타이머 (시간 초과 시 자동 스킵)
  setRoomTimer(room.id, room.settings.descriptionTimerSec * 1000, () => {
    const fresh = getRoom(room.id);
    if (!fresh || fresh.phase !== 'description') return;
    if (fresh.turnOrder[fresh.currentTurnIndex] !== currentPlayerId) return;
    submitDescription(io, fresh, currentPlayerId, '...');
  });

  // AI 플레이어면 2~5초 딜레이 후 자동 설명
  if (currentPlayer.isAI) {
    const delay = 2000 + Math.random() * 3000;
    setTimeout(() => {
      const fresh = getRoom(room.id);
      if (!fresh || fresh.phase !== 'description') return;
      if (fresh.turnOrder[fresh.currentTurnIndex] !== currentPlayerId) return;

      const text = generateAIDescription(
        currentPlayer.role ?? 'citizen',
        fresh.settings.keyword ?? '',
        fresh.settings.category,
        fresh.descriptions.map((d) => d.text),
      );
      submitDescription(io, fresh, currentPlayerId, text);
    }, delay);
  }
}

function submitDescription(io: TypedIO, room: Room, playerId: string, text: string): void {
  const player = room.players.find((p) => p.id === playerId);
  if (!player) return;

  const description = {
    playerId,
    playerName: player.name,
    text,
    submittedAt: Date.now(),
  };

  room.descriptions.push(description);
  room.currentTurnIndex++;

  const nextTurnPlayerId = room.turnOrder[room.currentTurnIndex];
  io.to(room.id).emit('game:description_submitted', { description, nextTurnPlayerId });

  if (room.currentTurnIndex >= room.turnOrder.length) {
    // 모든 설명 완료
    clearRoomTimer(room.id);
    setTimeout(() => {
      const fresh = getRoom(room.id);
      if (fresh?.phase === 'description') startDiscussion(io, fresh);
    }, 1000);
  } else {
    advanceDescriptionTurn(io, room);
  }
}

function startDiscussion(io: TypedIO, room: Room): void {
  room.phase = 'discussion';
  room.phaseStartAt = Date.now();

  io.to(room.id).emit('game:phase_change', {
    phase: 'discussion',
    phaseStartAt: room.phaseStartAt,
    durationSec: room.settings.discussionTimerSec,
  });

  scheduleAIMessages(io, room.id, room.settings.discussionTimerSec);

  setRoomTimer(room.id, room.settings.discussionTimerSec * 1000, () => {
    const fresh = getRoom(room.id);
    if (fresh?.phase === 'discussion') startVote(io, fresh);
  });
}

/** 토론 단계 AI 메시지 스케줄링 (AI당 1~2개, 랜덤 시간에 전송) */
function scheduleAIMessages(io: TypedIO, roomId: string, durationSec: number): void {
  const room = getRoom(roomId);
  if (!room) return;

  for (const ai of room.players.filter((p) => p.isAI)) {
    const msgCount = 1 + Math.floor(Math.random() * 2);
    for (let i = 0; i < msgCount; i++) {
      // 토론 시간의 10%~70% 사이 랜덤 시간에 발언
      const delay = durationSec * 1000 * (0.1 + Math.random() * 0.6);
      setTimeout(() => {
        const fresh = getRoom(roomId);
        if (!fresh || fresh.phase !== 'discussion') return;

        const text = generateAIMessage(
          ai.role ?? 'citizen',
          fresh.settings.keyword ?? '',
          fresh.settings.category,
          fresh.descriptions,
          fresh.messages,
          fresh.players,
          ai.id,
        );

        const message = {
          id: generateId(),
          playerId: ai.id,
          playerName: ai.name,
          text,
          isAI: true,
          createdAt: Date.now(),
        };

        fresh.messages.push(message);
        io.to(roomId).emit('game:message_received', { message });
      }, delay);
    }
  }
}

function startVote(io: TypedIO, room: Room): void {
  room.phase = 'vote';
  room.votes = [];
  room.phaseStartAt = Date.now();

  io.to(room.id).emit('game:phase_change', {
    phase: 'vote',
    phaseStartAt: room.phaseStartAt,
    durationSec: room.settings.voteTimerSec,
  });

  // AI 투표: 2~5초 딜레이
  for (const ai of room.players.filter((p) => p.isAI)) {
    const delay = 2000 + Math.random() * 3000;
    setTimeout(() => {
      const fresh = getRoom(room.id);
      if (!fresh || fresh.phase !== 'vote') return;
      if (fresh.votes.some((v) => v.voterId === ai.id)) return;

      const targetId = generateAIVote(
        ai.id,
        ai.role ?? 'citizen',
        fresh.players,
        fresh.descriptions,
      );
      submitVote(io, fresh, ai.id, targetId);
    }, delay);
  }

  setRoomTimer(room.id, room.settings.voteTimerSec * 1000, () => {
    const fresh = getRoom(room.id);
    if (fresh?.phase === 'vote') processVoteResult(io, fresh);
  });
}

function submitVote(io: TypedIO, room: Room, voterId: string, targetId: string): void {
  if (room.votes.some((v) => v.voterId === voterId)) return;

  room.votes.push({ voterId, targetId });

  io.to(room.id).emit('game:vote_submitted', {
    voterId,
    voteCount: room.votes.length,
    totalPlayers: room.players.length,
  });

  if (room.votes.length >= room.players.length) {
    clearRoomTimer(room.id);
    processVoteResult(io, room);
  }
}

function processVoteResult(io: TypedIO, room: Room): void {
  const { mostVotedId, counts } = tallyVotes(room.votes);
  const liarCaught = mostVotedId === room.liarId;

  const summary = Object.entries(counts)
    .map(([targetId, count]) => ({
      targetId,
      targetName: room.players.find((p) => p.id === targetId)?.name ?? '알 수 없음',
      count,
    }))
    .sort((a, b) => b.count - a.count);

  io.to(room.id).emit('game:vote_result', {
    summary,
    liarCaught,
    liarId: room.liarId!,
  });

  if (room.settings.mode === 'liar' && liarCaught) {
    // 라이어 지목 → 최종 변론
    setTimeout(() => {
      const fresh = getRoom(room.id);
      if (fresh?.phase === 'vote') startFinalDefense(io, fresh);
    }, 2000);
  } else {
    // 바보 모드 또는 라이어 미지목 → 결과
    const winCondition = determineWinner(
      room.settings.mode,
      room.liarId!,
      mostVotedId,
      undefined,
      room.settings.keyword ?? '',
    );
    setTimeout(() => {
      const fresh = getRoom(room.id);
      if (fresh) showResult(io, fresh, winCondition, undefined, false);
    }, 2000);
  }
}

function startFinalDefense(io: TypedIO, room: Room): void {
  room.phase = 'final_defense';
  room.phaseStartAt = Date.now();

  io.to(room.id).emit('game:phase_change', {
    phase: 'final_defense',
    phaseStartAt: room.phaseStartAt,
    durationSec: room.settings.finalDefenseTimerSec,
  });

  const liar = room.players.find((p) => p.id === room.liarId);

  if (liar?.isAI) {
    const delay = 3000 + Math.random() * 2000;
    setTimeout(() => {
      const fresh = getRoom(room.id);
      if (!fresh || fresh.phase !== 'final_defense') return;
      const guess = generateAIFinalAnswer(fresh.settings.category);
      submitFinalDefense(io, fresh, fresh.liarId!, guess);
    }, delay);
  }

  setRoomTimer(room.id, room.settings.finalDefenseTimerSec * 1000, () => {
    const fresh = getRoom(room.id);
    if (fresh?.phase === 'final_defense') submitFinalDefense(io, fresh, fresh.liarId!, '');
  });
}

function submitFinalDefense(io: TypedIO, room: Room, _playerId: string, keyword: string): void {
  clearRoomTimer(room.id);

  const correctKeyword = room.settings.keyword ?? '';
  const correct = keyword.trim().toLowerCase() === correctKeyword.trim().toLowerCase();

  io.to(room.id).emit('game:final_defense_submitted', { keyword, correct });

  const winCondition = determineWinner(
    room.settings.mode,
    room.liarId!,
    room.liarId!, // final_defense는 이미 라이어가 지목된 상황
    keyword,
    correctKeyword,
  );

  setTimeout(() => {
    const fresh = getRoom(room.id);
    if (fresh) showResult(io, fresh, winCondition, keyword, correct);
  }, 1500);
}

function showResult(
  io: TypedIO,
  room: Room,
  winCondition: WinCondition,
  liarGuessedKeyword: string | undefined,
  liarGuessCorrect: boolean,
): void {
  clearRoomTimer(room.id);
  foolKeywords.delete(room.id);

  room.phase = 'result';
  room.keyword = room.settings.keyword;
  room.phaseStartAt = Date.now();

  const liar = room.players.find((p) => p.id === room.liarId);
  const { counts } = tallyVotes(room.votes);

  const voteSummary = Object.entries(counts)
    .map(([targetId, count]) => ({
      targetId,
      targetName: room.players.find((p) => p.id === targetId)?.name ?? '알 수 없음',
      count,
    }))
    .sort((a, b) => b.count - a.count);

  const result: GameResult = {
    winCondition,
    liarId: room.liarId!,
    liarName: liar?.name ?? '알 수 없음',
    keyword: room.settings.keyword ?? '',
    voteSummary,
    liarGuessedKeyword,
    liarGuessCorrect,
  };

  room.gameResult = result;

  io.to(room.id).emit('game:phase_change', {
    phase: 'result',
    phaseStartAt: room.phaseStartAt,
    durationSec: 0,
  });

  io.to(room.id).emit('game:result', { result });
}

// ── 퇴장 공통 처리 ────────────────────────────────────────────────────────────

function handlePlayerLeave(io: TypedIO, socket: TypedSocket, roomId: string): void {
  const { playerId } = socket.data;
  if (!playerId) return;

  playerSocketMap.delete(playerId);
  socket.leave(roomId);

  const room = getRoom(roomId);
  if (!room) return;

  const player = room.players.find((p) => p.id === playerId);
  if (!player) return;

  if (room.phase === 'waiting') {
    const updated = removePlayer(roomId, playerId);
    if (updated.players.length > 0) {
      io.to(roomId).emit('room:player_left', { playerId, room: sanitizeRoom(updated) });
    }
  } else {
    // 게임 진행 중 → 연결 끊김 표시만
    player.isConnected = false;
    broadcastRoomUpdate(io, room);
  }
}

// ── 메인 초기화 ───────────────────────────────────────────────────────────────

export function initSocketServer(io: TypedIO): void {
  io.on('connection', (socket: TypedSocket) => {
    console.info(`[Socket] 연결: ${socket.id}`);

    // ── room:create ──────────────────────────────────────────────────────────
    socket.on('room:create', ({ playerName }, callback) => {
      try {
        const room = createRoom(playerName);
        const host = room.players[0];

        socket.data = { playerId: host.id, roomId: room.id, playerName: host.name };
        playerSocketMap.set(host.id, socket.id);
        socket.join(room.id);

        callback({ ok: true, data: { room: sanitizeRoom(room), playerId: host.id } });
      } catch (e) {
        callback({ ok: false, error: (e as Error).message });
      }
    });

    // ── room:join ────────────────────────────────────────────────────────────
    socket.on('room:join', (payload, callback) => {
      try {
        const { roomCode, playerName } = payload;
        const existingRoom = getRoomByCode(roomCode);

        if (!existingRoom) {
          callback({ ok: false, error: '방을 찾을 수 없습니다.' });
          return;
        }

        // 동일 이름 플레이어 재연결 처리 (호스트 or 새로고침)
        const existing = existingRoom.players.find((p) => p.name === playerName && !p.isAI);
        if (existing) {
          existing.isConnected = true;
          socket.data = { playerId: existing.id, roomId: existingRoom.id, playerName };
          playerSocketMap.set(existing.id, socket.id);
          socket.join(existingRoom.id);

          callback({ ok: true, data: { room: sanitizeRoom(existingRoom), playerId: existing.id } });
          broadcastRoomUpdate(io, existingRoom);
          return;
        }

        const { room, player } = joinRoom(roomCode, playerName);
        socket.data = { playerId: player.id, roomId: room.id, playerName };
        playerSocketMap.set(player.id, socket.id);
        socket.join(room.id);

        io.to(room.id).emit('room:player_joined', { player, room: sanitizeRoom(room) });
        callback({ ok: true, data: { room: sanitizeRoom(room), playerId: player.id } });
      } catch (e) {
        callback({ ok: false, error: (e as Error).message });
      }
    });

    // ── room:leave ───────────────────────────────────────────────────────────
    socket.on('room:leave', ({ roomId }) => {
      handlePlayerLeave(io, socket, roomId);
    });

    // ── room:add_ai ──────────────────────────────────────────────────────────
    socket.on('room:add_ai', ({ roomId }, callback) => {
      try {
        const room = getRoom(roomId);
        if (!room) { callback({ ok: false, error: '방을 찾을 수 없습니다.' }); return; }
        if (socket.data.playerId !== room.hostId) {
          callback({ ok: false, error: '호스트만 AI를 추가할 수 있습니다.' }); return;
        }

        const player = addAIPlayer(roomId);
        io.to(roomId).emit('room:player_joined', { player, room: sanitizeRoom(room) });
        callback({ ok: true, data: { player } });
      } catch (e) {
        callback({ ok: false, error: (e as Error).message });
      }
    });

    // ── room:remove_player ───────────────────────────────────────────────────
    socket.on('room:remove_player', ({ roomId, targetPlayerId }, callback) => {
      try {
        const room = getRoom(roomId);
        if (!room) { callback({ ok: false, error: '방을 찾을 수 없습니다.' }); return; }
        if (socket.data.playerId !== room.hostId) {
          callback({ ok: false, error: '호스트만 플레이어를 추방할 수 있습니다.' }); return;
        }

        // 추방 대상 소켓에 알림
        const targetSocketId = playerSocketMap.get(targetPlayerId);
        if (targetSocketId) {
          io.to(targetSocketId).emit('notification', {
            message: '방에서 추방되었습니다.',
            type: 'warn',
          });
        }

        const updated = removePlayer(roomId, targetPlayerId);
        playerSocketMap.delete(targetPlayerId);
        io.to(roomId).emit('room:player_left', { playerId: targetPlayerId, room: sanitizeRoom(updated) });
        callback({ ok: true, data: undefined });
      } catch (e) {
        callback({ ok: false, error: (e as Error).message });
      }
    });

    // ── room:update_settings ─────────────────────────────────────────────────
    socket.on('room:update_settings', ({ roomId, settings }, callback) => {
      try {
        const room = getRoom(roomId);
        if (!room) { callback({ ok: false, error: '방을 찾을 수 없습니다.' }); return; }
        if (socket.data.playerId !== room.hostId) {
          callback({ ok: false, error: '호스트만 설정을 변경할 수 있습니다.' }); return;
        }
        if (room.phase !== 'waiting') {
          callback({ ok: false, error: '대기 중에만 설정을 변경할 수 있습니다.' }); return;
        }

        Object.assign(room.settings, settings);
        broadcastRoomUpdate(io, room);
        callback({ ok: true, data: undefined });
      } catch (e) {
        callback({ ok: false, error: (e as Error).message });
      }
    });

    // ── room:start ───────────────────────────────────────────────────────────
    socket.on('room:start', async ({ roomId, apiKey }, callback) => {
      try {
        const room = getRoom(roomId);
        if (!room) { callback({ ok: false, error: '방을 찾을 수 없습니다.' }); return; }
        if (socket.data.playerId !== room.hostId) {
          callback({ ok: false, error: '호스트만 게임을 시작할 수 있습니다.' }); return;
        }
        if (room.phase !== 'waiting') {
          callback({ ok: false, error: '이미 게임이 진행 중입니다.' }); return;
        }
        if (room.players.length < 2) {
          callback({ ok: false, error: '최소 2명이 필요합니다.' }); return;
        }
        const isAISuggestCategory = room.settings.category === 'ai_suggest';
        if (!room.settings.category) {
          callback({ ok: false, error: '카테고리를 선택해 주세요.' }); return;
        }
        if (isAISuggestCategory && !room.settings.useAIKeywords) {
          callback({ ok: false, error: 'AI 추천 카테고리는 AI 키워드 기능이 필요합니다.' }); return;
        }

        // 역할 배정
        const assigned = assignRoles(room.players, room.settings.mode);
        room.players = assigned as Player[];
        room.liarId = assigned.find((p) => p.role === 'liar')!.id;

        // 키워드 선택 (AI 또는 내장)
        let keyword: string;
        let foolKeyword: string | undefined;

        const effectiveApiKey = apiKey || process.env.ANTHROPIC_API_KEY;
        if (room.settings.useAIKeywords && effectiveApiKey) {
          try {
            const count = room.settings.mode === 'fool' ? 2 : 1;
            if (isAISuggestCategory) {
              // AI가 카테고리와 키워드를 함께 생성
              const result = await claudeCategoryAndKeywords(count, effectiveApiKey);
              room.settings.category = result.categoryId;
              keyword = result.keywords[0];
              if (room.settings.mode === 'fool' && result.keywords.length >= 2) {
                foolKeyword = result.keywords[1];
              }
            } else {
              const result = await claudeKeywords(getCategoryLabel(room.settings.category), count, effectiveApiKey);
              keyword = result.keywords[0];
              if (room.settings.mode === 'fool' && result.keywords.length >= 2) {
                foolKeyword = result.keywords[1];
              }
            }
          } catch {
            // AI 실패 시 내장 키워드로 폴백 (ai_suggest면 랜덤 카테고리 선택)
            if (isAISuggestCategory) {
              const { CATEGORIES: CATS } = await import('@/constants/categories');
              room.settings.category = CATS[Math.floor(Math.random() * CATS.length)].id;
            }
            const fallback = selectKeyword(room.settings.category, room.settings.mode);
            keyword = fallback.keyword;
            foolKeyword = fallback.foolKeyword;
          }
        } else {
          const result = selectKeyword(room.settings.category, room.settings.mode);
          keyword = result.keyword;
          foolKeyword = result.foolKeyword;
        }

        room.settings.keyword = keyword;
        if (foolKeyword) foolKeywords.set(room.id, foolKeyword);

        // 게임 상태 초기화
        room.turnOrder = shuffleTurnOrder(room.players);
        room.currentTurnIndex = 0;
        room.descriptions = [];
        room.messages = [];
        room.votes = [];
        room.gameResult = undefined;

        callback({ ok: true, data: undefined });
        startRoleReveal(io, room);
      } catch (e) {
        callback({ ok: false, error: (e as Error).message });
      }
    });

    // ── game:submit_description ──────────────────────────────────────────────
    socket.on('game:submit_description', ({ roomId, text }, callback) => {
      try {
        const room = getRoom(roomId);
        if (!room) { callback({ ok: false, error: '방을 찾을 수 없습니다.' }); return; }
        if (room.phase !== 'description') {
          callback({ ok: false, error: '설명 단계가 아닙니다.' }); return;
        }

        const playerId = socket.data.playerId;
        if (room.turnOrder[room.currentTurnIndex] !== playerId) {
          callback({ ok: false, error: '현재 당신의 차례가 아닙니다.' }); return;
        }

        clearRoomTimer(roomId);
        callback({ ok: true, data: undefined });
        submitDescription(io, room, playerId, text.trim() || '...');
      } catch (e) {
        callback({ ok: false, error: (e as Error).message });
      }
    });

    // ── game:send_message ────────────────────────────────────────────────────
    socket.on('game:send_message', ({ roomId, text }, callback) => {
      try {
        const room = getRoom(roomId);
        if (!room) { callback({ ok: false, error: '방을 찾을 수 없습니다.' }); return; }
        if (room.phase !== 'discussion') {
          callback({ ok: false, error: '토론 단계가 아닙니다.' }); return;
        }

        const playerId = socket.data.playerId;
        const player = room.players.find((p) => p.id === playerId);
        if (!player) { callback({ ok: false, error: '플레이어를 찾을 수 없습니다.' }); return; }

        const message = {
          id: generateId(),
          playerId,
          playerName: player.name,
          text: text.trim(),
          isAI: false,
          createdAt: Date.now(),
        };

        room.messages.push(message);
        io.to(roomId).emit('game:message_received', { message });
        callback({ ok: true, data: { message } });
      } catch (e) {
        callback({ ok: false, error: (e as Error).message });
      }
    });

    // ── game:submit_vote ─────────────────────────────────────────────────────
    socket.on('game:submit_vote', ({ roomId, targetId }, callback) => {
      try {
        const room = getRoom(roomId);
        if (!room) { callback({ ok: false, error: '방을 찾을 수 없습니다.' }); return; }
        if (room.phase !== 'vote') {
          callback({ ok: false, error: '투표 단계가 아닙니다.' }); return;
        }

        const voterId = socket.data.playerId;
        if (room.votes.some((v) => v.voterId === voterId)) {
          callback({ ok: false, error: '이미 투표했습니다.' }); return;
        }
        if (!room.players.some((p) => p.id === targetId)) {
          callback({ ok: false, error: '존재하지 않는 플레이어입니다.' }); return;
        }

        callback({ ok: true, data: undefined });
        submitVote(io, room, voterId, targetId);
      } catch (e) {
        callback({ ok: false, error: (e as Error).message });
      }
    });

    // ── game:submit_final_defense ────────────────────────────────────────────
    socket.on('game:submit_final_defense', ({ roomId, keyword }, callback) => {
      try {
        const room = getRoom(roomId);
        if (!room) { callback({ ok: false, error: '방을 찾을 수 없습니다.' }); return; }
        if (room.phase !== 'final_defense') {
          callback({ ok: false, error: '최종 변론 단계가 아닙니다.' }); return;
        }
        if (socket.data.playerId !== room.liarId) {
          callback({ ok: false, error: '라이어만 답변할 수 있습니다.' }); return;
        }

        callback({ ok: true, data: undefined });
        submitFinalDefense(io, room, socket.data.playerId, keyword);
      } catch (e) {
        callback({ ok: false, error: (e as Error).message });
      }
    });

    // ── room:play_again ──────────────────────────────────────────────────────
    socket.on('room:play_again', ({ roomId }, callback) => {
      try {
        const room = getRoom(roomId);
        if (!room) { callback({ ok: false, error: '방을 찾을 수 없습니다.' }); return; }
        if (room.phase !== 'result') {
          callback({ ok: false, error: '결과 화면에서만 가능합니다.' }); return;
        }

        clearRoomTimer(roomId);
        foolKeywords.delete(roomId);

        room.phase = 'waiting';
        room.turnOrder = [];
        room.currentTurnIndex = 0;
        room.descriptions = [];
        room.messages = [];
        room.votes = [];
        room.liarId = undefined;
        room.keyword = undefined;
        room.gameResult = undefined;
        room.phaseStartAt = undefined;
        room.settings.keyword = undefined;
        room.players.forEach((p) => { delete p.role; });

        broadcastRoomUpdate(io, room);
        callback({ ok: true, data: undefined });
      } catch (e) {
        callback({ ok: false, error: (e as Error).message });
      }
    });

    // ── timer:sync ───────────────────────────────────────────────────────────
    // 클라이언트가 현재 페이즈의 타이머 정보를 요청할 때
    socket.on('timer:sync', ({ roomId }, callback) => {
      const room = getRoom(roomId);
      if (!room || !room.phaseStartAt) {
        callback({ ok: false, error: '방 정보를 찾을 수 없습니다.' });
        return;
      }

      const durationMap: Partial<Record<string, number>> = {
        role_reveal: 10,
        description: room.settings.descriptionTimerSec,
        discussion: room.settings.discussionTimerSec,
        vote: room.settings.voteTimerSec,
        final_defense: room.settings.finalDefenseTimerSec,
      };

      callback({
        ok: true,
        data: {
          phase: room.phase,
          phaseStartAt: room.phaseStartAt,
          durationSec: durationMap[room.phase] ?? 0,
        },
      });
    });

    // ── disconnect ───────────────────────────────────────────────────────────
    socket.on('disconnect', (reason) => {
      const { playerId, roomId } = socket.data;
      if (!playerId || !roomId) return;

      console.info(`[Socket] 연결 해제: ${socket.id} (${reason})`);
      handlePlayerLeave(io, socket, roomId);
    });
  });
}
