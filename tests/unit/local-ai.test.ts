import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  generateAIDescription,
  generateAIMessage,
  generateAIVote,
  generateAIFinalAnswer,
  randomDelay,
} from '@/lib/ai/local-ai';
import type { Description, Message, Player } from '@/types/game';

// ─── 테스트 픽스처 ──────────────────────────────────────────────────────────

const makePlayers = (count: number, selfId = 'p1'): Player[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `p${i + 1}`,
    name: `플레이어${i + 1}`,
    isAI: false,
    isHost: i === 0,
    isConnected: true,
    isReady: true,
    role: i === 0 ? 'liar' : 'citizen',
  })) as Player[];

const makeDescription = (playerId: string, text: string): Description => ({
  playerId,
  playerName: `플레이어${playerId.slice(1)}`,
  text,
  submittedAt: Date.now(),
});

const makeMessage = (playerId: string, text: string): Message => ({
  id: `msg-${playerId}`,
  playerId,
  playerName: `플레이어${playerId.slice(1)}`,
  text,
  isAI: true,
  createdAt: Date.now(),
});

// ─── generateAIDescription ──────────────────────────────────────────────────

describe('generateAIDescription', () => {
  it('시민: 문자열을 반환한다', () => {
    const result = generateAIDescription('citizen', '치킨', 'food', []);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('라이어: 문자열을 반환한다', () => {
    const result = generateAIDescription('liar', '', 'food', []);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('시민: 알 수 없는 카테고리에서 기본 템플릿으로 폴백한다', () => {
    const result = generateAIDescription('citizen', '뭔가', 'unknown_category', []);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('라이어: 알 수 없는 카테고리에서 기본 템플릿으로 폴백한다', () => {
    const result = generateAIDescription('liar', '', 'unknown_category', []);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('시민: 이미 사용된 템플릿을 피한다', () => {
    // 같은 카테고리에서 여러 번 호출할 때 중복을 최소화하는지 확인
    const results = new Set<string>();
    for (let i = 0; i < 10; i++) {
      results.add(generateAIDescription('citizen', '피자', 'food', [...results]));
    }
    // 적어도 2개 이상 다른 결과가 나와야 함 (템플릿이 여러 개이므로)
    expect(results.size).toBeGreaterThan(1);
  });

  it('지원하는 모든 카테고리에서 동작한다', () => {
    const categories = [
      'food', 'animal', 'job', 'movie', 'country',
      'sports', 'instrument', 'weather', 'transport', 'appliance',
    ];
    for (const cat of categories) {
      expect(() => generateAIDescription('citizen', 'keyword', cat, [])).not.toThrow();
      expect(() => generateAIDescription('liar', '', cat, [])).not.toThrow();
    }
  });
});

// ─── generateAIMessage ──────────────────────────────────────────────────────

describe('generateAIMessage', () => {
  const players = makePlayers(4);
  const descriptions: Description[] = [
    makeDescription('p1', '이것은 매우 특이한 음식이에요.'),
    makeDescription('p2', '자주 먹는 음식입니다.'),
    makeDescription('p3', '맛있는 음식이에요.'),
    makeDescription('p4', '독특해요.'),
  ];
  const messages: Message[] = [makeMessage('p2', '저는 p3이 의심돼요.')];

  it('시민: 문자열 메시지를 반환한다', () => {
    const result = generateAIMessage('citizen', '치킨', 'food', descriptions, messages, players, 'p2');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('라이어: 문자열 메시지를 반환한다', () => {
    const result = generateAIMessage('liar', '', 'food', descriptions, messages, players, 'p1');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('혼자뿐일 때 중립 메시지를 반환한다', () => {
    const soloPlayer = makePlayers(1);
    const result = generateAIMessage('citizen', '치킨', 'food', [], [], soloPlayer, 'p1');
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('메시지가 비어 있어도 동작한다', () => {
    const result = generateAIMessage('citizen', '피자', 'food', [], [], players, 'p1');
    expect(typeof result).toBe('string');
  });
});

// ─── generateAIVote ─────────────────────────────────────────────────────────

describe('generateAIVote', () => {
  const players = makePlayers(4);

  it('자기 자신을 제외한 플레이어 id를 반환한다', () => {
    const result = generateAIVote('p1', 'citizen', players, []);
    expect(result).not.toBe('p1');
    expect(players.map((p) => p.id)).toContain(result);
  });

  it('라이어: 자신 외 다른 플레이어를 지목한다', () => {
    const result = generateAIVote('p1', 'liar', players, []);
    expect(result).not.toBe('p1');
  });

  it('시민: 짧은 설명을 한 플레이어를 의심한다', () => {
    const descriptions: Description[] = [
      makeDescription('p2', '이것은 매우 특이한 특징을 가진 음식이에요.'),
      makeDescription('p3', '맛있어요.'), // 짧음 → 의심
      makeDescription('p4', '특별한 날에 자주 먹는 음식입니다.'),
    ];
    // 여러 번 호출해서 p3가 자주 선택되는지 확인
    const votes: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const v = generateAIVote('p1', 'citizen', players, descriptions);
      votes[v] = (votes[v] ?? 0) + 1;
    }
    // p3가 가장 많이 투표받아야 함
    const topVoted = Object.entries(votes).sort(([, a], [, b]) => b - a)[0][0];
    expect(topVoted).toBe('p3');
  });

  it('플레이어가 1명(자신)뿐이면 selfId를 반환한다', () => {
    const solo = [players[0]];
    const result = generateAIVote('p1', 'citizen', solo, []);
    expect(result).toBe('p1');
  });
});

// ─── generateAIFinalAnswer ──────────────────────────────────────────────────

describe('generateAIFinalAnswer', () => {
  it('지원하는 카테고리에서 비어 있지 않은 문자열을 반환한다', () => {
    const categories = [
      'food', 'animal', 'job', 'movie', 'country',
      'sports', 'instrument', 'weather', 'transport', 'appliance',
    ];
    for (const cat of categories) {
      const result = generateAIFinalAnswer(cat);
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
    }
  });

  it('알 수 없는 카테고리에서 폴백 문자열을 반환한다', () => {
    const result = generateAIFinalAnswer('unknown_xyz');
    expect(result).toBe('모르겠어요');
  });

  it('같은 카테고리에서 여러 번 호출해도 예외가 발생하지 않는다', () => {
    expect(() => {
      for (let i = 0; i < 20; i++) generateAIFinalAnswer('food');
    }).not.toThrow();
  });
});

// ─── randomDelay ────────────────────────────────────────────────────────────

describe('randomDelay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('Promise를 반환한다', () => {
    const result = randomDelay(100, 200);
    expect(result).toBeInstanceOf(Promise);
    vi.runAllTimers();
  });

  it('최소/최대 범위 내에서 resolve된다', async () => {
    const promise = randomDelay(1000, 2000);
    vi.advanceTimersByTime(2000);
    await expect(promise).resolves.toBeUndefined();
  });

  it('지정한 시간 전에는 resolve되지 않는다', async () => {
    let resolved = false;
    const promise = randomDelay(1000, 1000).then(() => {
      resolved = true;
    });
    vi.advanceTimersByTime(999);
    // 아직 resolve 안 됨
    expect(resolved).toBe(false);
    vi.advanceTimersByTime(1);
    await promise;
    expect(resolved).toBe(true);
  });
});
