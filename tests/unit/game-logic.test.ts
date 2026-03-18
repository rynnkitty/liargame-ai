import { describe, it, expect } from 'vitest';
import {
  assignRoles,
  selectKeyword,
  shuffleTurnOrder,
  tallyVotes,
  determineWinner,
} from '@/lib/game-logic';
import { Player, Vote } from '@/types/game';
import { KEYWORDS } from '@/constants/keywords';

// ─── 테스트 픽스처 ────────────────────────────────────────────────────────────

function makePlayers(count: number): Player[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `player-${i + 1}`,
    name: `플레이어${i + 1}`,
    isAI: false,
    isHost: i === 0,
    isConnected: true,
    isReady: true,
  }));
}

function makeVotes(pairs: [string, string][]): Vote[] {
  return pairs.map(([voterId, targetId]) => ({ voterId, targetId }));
}

// ─── assignRoles ─────────────────────────────────────────────────────────────

describe('assignRoles', () => {
  it('라이어가 정확히 1명 배정된다 (liar 모드, 2명)', () => {
    const players = makePlayers(2);
    const assigned = assignRoles(players, 'liar');
    const liars = assigned.filter((p) => p.role === 'liar');
    expect(liars).toHaveLength(1);
  });

  it('나머지는 모두 시민이다', () => {
    const players = makePlayers(6);
    const assigned = assignRoles(players, 'liar');
    const liars = assigned.filter((p) => p.role === 'liar');
    const citizens = assigned.filter((p) => p.role === 'citizen');
    expect(liars).toHaveLength(1);
    expect(citizens).toHaveLength(5);
  });

  it('fool 모드에서도 라이어(바보)가 정확히 1명 배정된다', () => {
    const players = makePlayers(4);
    const assigned = assignRoles(players, 'fool');
    const liars = assigned.filter((p) => p.role === 'liar');
    expect(liars).toHaveLength(1);
  });

  it('원래 플레이어 데이터는 유지된다 (불변)', () => {
    const players = makePlayers(3);
    const assigned = assignRoles(players, 'liar');
    expect(assigned[0].id).toBe('player-1');
    expect(assigned[0].name).toBe('플레이어1');
    expect(assigned[0].isHost).toBe(true);
  });

  it('2명 미만이면 에러를 던진다', () => {
    expect(() => assignRoles(makePlayers(1), 'liar')).toThrow();
    expect(() => assignRoles([], 'liar')).toThrow();
  });

  it('여러 번 실행 시 라이어가 다양하게 배정된다 (랜덤성 검증)', () => {
    const players = makePlayers(5);
    const liarIds = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const assigned = assignRoles(players, 'liar');
      const liar = assigned.find((p) => p.role === 'liar')!;
      liarIds.add(liar.id);
    }
    // 100번 중 적어도 2명 이상이 라이어로 뽑혀야 한다
    expect(liarIds.size).toBeGreaterThan(1);
  });
});

// ─── selectKeyword ────────────────────────────────────────────────────────────

describe('selectKeyword', () => {
  it('liar 모드: 유효한 keyword를 반환하고 foolKeyword는 없다', () => {
    const result = selectKeyword('food', 'liar');
    expect(KEYWORDS.food).toContain(result.keyword);
    expect(result.foolKeyword).toBeUndefined();
  });

  it('fool 모드: keyword와 foolKeyword 모두 반환한다', () => {
    const result = selectKeyword('food', 'fool');
    expect(result.keyword).toBeDefined();
    expect(result.foolKeyword).toBeDefined();
  });

  it('fool 모드: keyword와 foolKeyword는 서로 다르다', () => {
    const result = selectKeyword('food', 'fool');
    expect(result.keyword).not.toBe(result.foolKeyword);
  });

  it('fool 모드: 두 키워드 모두 같은 카테고리 안에 있다', () => {
    const result = selectKeyword('animal', 'fool');
    expect(KEYWORDS.animal).toContain(result.keyword);
    expect(KEYWORDS.animal).toContain(result.foolKeyword);
  });

  it('모든 카테고리에서 정상 동작한다', () => {
    const categories = Object.keys(KEYWORDS);
    for (const cat of categories) {
      const result = selectKeyword(cat, 'liar');
      expect(KEYWORDS[cat]).toContain(result.keyword);
    }
  });

  it('잘못된 카테고리면 에러를 던진다', () => {
    expect(() => selectKeyword('존재하지않는카테고리', 'liar')).toThrow();
  });
});

// ─── shuffleTurnOrder ─────────────────────────────────────────────────────────

describe('shuffleTurnOrder', () => {
  it('같은 플레이어 ID가 모두 포함된다', () => {
    const players = makePlayers(5);
    const order = shuffleTurnOrder(players);
    expect(order).toHaveLength(5);
    const expected = players.map((p) => p.id).sort();
    expect(order.slice().sort()).toEqual(expected);
  });

  it('플레이어가 1명이면 배열 길이 1을 반환한다', () => {
    const order = shuffleTurnOrder(makePlayers(1));
    expect(order).toHaveLength(1);
  });

  it('빈 배열이면 빈 배열을 반환한다', () => {
    expect(shuffleTurnOrder([])).toEqual([]);
  });

  it('원본 players 배열을 변경하지 않는다 (불변)', () => {
    const players = makePlayers(4);
    const originalIds = players.map((p) => p.id);
    shuffleTurnOrder(players);
    expect(players.map((p) => p.id)).toEqual(originalIds);
  });

  it('여러 번 실행 시 다른 순서가 나온다 (랜덤성 검증)', () => {
    const players = makePlayers(6);
    const orders = new Set<string>();
    for (let i = 0; i < 50; i++) {
      orders.add(shuffleTurnOrder(players).join(','));
    }
    expect(orders.size).toBeGreaterThan(1);
  });
});

// ─── tallyVotes ───────────────────────────────────────────────────────────────

describe('tallyVotes', () => {
  it('단일 최다 득표자를 올바르게 반환한다', () => {
    const votes = makeVotes([
      ['v1', 'p2'],
      ['v2', 'p2'],
      ['v3', 'p3'],
    ]);
    const result = tallyVotes(votes);
    expect(result.mostVotedId).toBe('p2');
    expect(result.isTie).toBe(false);
    expect(result.counts['p2']).toBe(2);
    expect(result.counts['p3']).toBe(1);
  });

  it('동률이면 mostVotedId가 null이고 isTie가 true다', () => {
    const votes = makeVotes([
      ['v1', 'p1'],
      ['v2', 'p2'],
      ['v3', 'p1'],
      ['v4', 'p2'],
    ]);
    const result = tallyVotes(votes);
    expect(result.mostVotedId).toBeNull();
    expect(result.isTie).toBe(true);
  });

  it('3명 동률도 처리한다', () => {
    const votes = makeVotes([
      ['v1', 'p1'],
      ['v2', 'p2'],
      ['v3', 'p3'],
    ]);
    const result = tallyVotes(votes);
    expect(result.mostVotedId).toBeNull();
    expect(result.isTie).toBe(true);
  });

  it('한 명에게 모든 투표가 몰리면 그 사람이 반환된다', () => {
    const votes = makeVotes([
      ['v1', 'p5'],
      ['v2', 'p5'],
      ['v3', 'p5'],
    ]);
    const result = tallyVotes(votes);
    expect(result.mostVotedId).toBe('p5');
    expect(result.isTie).toBe(false);
  });

  it('투표가 없으면 mostVotedId가 null이고 isTie가 false다', () => {
    const result = tallyVotes([]);
    expect(result.mostVotedId).toBeNull();
    expect(result.isTie).toBe(false);
    expect(result.counts).toEqual({});
  });

  it('투표가 1개면 해당 플레이어가 반환된다', () => {
    const votes = makeVotes([['v1', 'p3']]);
    const result = tallyVotes(votes);
    expect(result.mostVotedId).toBe('p3');
    expect(result.isTie).toBe(false);
  });
});

// ─── determineWinner ──────────────────────────────────────────────────────────

describe('determineWinner — liar 모드', () => {
  const LIAR_ID = 'player-liar';
  const CITIZEN_ID = 'player-citizen';
  const KEYWORD = '삼겹살';

  it('라이어를 못 잡으면 liar_wins', () => {
    expect(determineWinner('liar', LIAR_ID, CITIZEN_ID, undefined, KEYWORD)).toBe('liar_wins');
  });

  it('동률(null)이면 라이어가 지목 안 된 것으로 처리 → liar_wins', () => {
    expect(determineWinner('liar', LIAR_ID, null, undefined, KEYWORD)).toBe('liar_wins');
  });

  it('라이어를 잡았고 정답을 못 맞추면 citizens_win', () => {
    expect(determineWinner('liar', LIAR_ID, LIAR_ID, '치킨', KEYWORD)).toBe('citizens_win');
  });

  it('라이어를 잡았고 liarGuess가 undefined면 citizens_win', () => {
    expect(determineWinner('liar', LIAR_ID, LIAR_ID, undefined, KEYWORD)).toBe('citizens_win');
  });

  it('라이어를 잡았지만 정답을 맞추면 liar_wins (역전)', () => {
    expect(determineWinner('liar', LIAR_ID, LIAR_ID, KEYWORD, KEYWORD)).toBe('liar_wins');
  });

  it('앞뒤 공백을 무시하고 정답을 판정한다', () => {
    expect(determineWinner('liar', LIAR_ID, LIAR_ID, '  삼겹살  ', KEYWORD)).toBe('liar_wins');
  });
});

describe('determineWinner — fool 모드', () => {
  const FOOL_ID = 'player-fool';
  const CITIZEN_ID = 'player-citizen';
  const KEYWORD = '강아지';

  it('바보가 지목되면 fool_caught (바보 승)', () => {
    expect(determineWinner('fool', FOOL_ID, FOOL_ID, undefined, KEYWORD)).toBe('fool_caught');
  });

  it('다른 사람이 지목되면 fool_missed (시민 승)', () => {
    expect(determineWinner('fool', FOOL_ID, CITIZEN_ID, undefined, KEYWORD)).toBe('fool_missed');
  });

  it('동률(null)이면 바보를 못 잡은 것 → fool_missed', () => {
    expect(determineWinner('fool', FOOL_ID, null, undefined, KEYWORD)).toBe('fool_missed');
  });

  it('fool 모드에서는 liarGuess가 있어도 결과에 영향 없다', () => {
    // 바보가 지목됐을 때: 정답 여부와 무관하게 fool_caught
    expect(determineWinner('fool', FOOL_ID, FOOL_ID, KEYWORD, KEYWORD)).toBe('fool_caught');
    expect(determineWinner('fool', FOOL_ID, FOOL_ID, '오답', KEYWORD)).toBe('fool_caught');
  });
});
