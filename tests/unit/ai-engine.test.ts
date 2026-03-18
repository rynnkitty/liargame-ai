import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { AIContext } from '@/types/ai';

// ─── 모듈 모킹 ────────────────────────────────────────────────────────────────

// Claude AI 함수 전체 모킹
vi.mock('@/lib/ai/claude-ai', () => ({
  claudeDescribe: vi.fn(),
  claudeDiscuss: vi.fn(),
  claudeVote: vi.fn(),
  claudeFinalDefense: vi.fn(),
}));

// local-ai의 randomDelay만 모킹 (실제 AI 로직은 유지)
vi.mock('@/lib/ai/local-ai', async () => {
  const actual = await vi.importActual<typeof import('@/lib/ai/local-ai')>('@/lib/ai/local-ai');
  return {
    ...actual,
    randomDelay: vi.fn().mockResolvedValue(undefined),
  };
});

// 모킹 이후에 임포트
import { getAIAction } from '@/lib/ai/ai-engine';
import {
  claudeDescribe,
  claudeDiscuss,
  claudeVote,
  claudeFinalDefense,
} from '@/lib/ai/claude-ai';
import { randomDelay } from '@/lib/ai/local-ai';

// ─── 테스트 픽스처 ────────────────────────────────────────────────────────────

const baseContext: AIContext = {
  playerId: 'player-1',
  role: 'citizen',
  category: 'food',
  keyword: '치킨',
  descriptions: [],
  messages: [],
  playerIds: ['player-1', 'player-2', 'player-3'],
  playerNames: ['알파', '베타', '감마'],
};

const liarContext: AIContext = {
  ...baseContext,
  role: 'liar',
  keyword: undefined,
};

// ─── API 키 없음 (로컬 AI 사용) ───────────────────────────────────────────────

describe('getAIAction — API 키 없음 (로컬 AI)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('describe: 설명 텍스트 응답을 반환한다', async () => {
    const result = await getAIAction('describe', baseContext, undefined, false);
    expect(result.type).toBe('describe');
    expect(result.usedClaude).toBe(false);
    if (result.type === 'describe') {
      expect(typeof result.text).toBe('string');
      expect(result.text.length).toBeGreaterThan(0);
    }
  });

  it('discuss: 토론 메시지 응답을 반환한다', async () => {
    const result = await getAIAction('discuss', baseContext, undefined, false);
    expect(result.type).toBe('discuss');
    expect(result.usedClaude).toBe(false);
    if (result.type === 'discuss') {
      expect(typeof result.text).toBe('string');
    }
  });

  it('vote: 투표 대상 ID를 반환한다', async () => {
    const result = await getAIAction('vote', baseContext, undefined, false);
    expect(result.type).toBe('vote');
    expect(result.usedClaude).toBe(false);
    if (result.type === 'vote') {
      expect(typeof result.targetId).toBe('string');
    }
  });

  it('final_defense: 키워드 추측을 반환한다', async () => {
    const result = await getAIAction('final_defense', liarContext, undefined, false);
    expect(result.type).toBe('final_defense');
    expect(result.usedClaude).toBe(false);
    if (result.type === 'final_defense') {
      expect(typeof result.keyword).toBe('string');
    }
  });

  it('라이어 역할로 describe: 설명을 반환한다', async () => {
    const result = await getAIAction('describe', liarContext, undefined, false);
    expect(result.type).toBe('describe');
    expect(result.usedClaude).toBe(false);
  });

  it('Claude 함수를 호출하지 않는다', async () => {
    await getAIAction('describe', baseContext, undefined, false);
    expect(claudeDescribe).not.toHaveBeenCalled();
  });
});

// ─── API 키 있음 (Claude AI) ──────────────────────────────────────────────────

describe('getAIAction — API 키 있음 (Claude AI)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('describe: claudeDescribe를 호출한다', async () => {
    vi.mocked(claudeDescribe).mockResolvedValue({
      type: 'describe',
      text: 'Claude가 생성한 설명',
      usedClaude: true,
    });

    const result = await getAIAction('describe', baseContext, 'test-api-key', false);
    expect(claudeDescribe).toHaveBeenCalledWith(baseContext, 'test-api-key');
    expect(result.usedClaude).toBe(true);
    if (result.type === 'describe') {
      expect(result.text).toBe('Claude가 생성한 설명');
    }
  });

  it('discuss: claudeDiscuss를 호출한다', async () => {
    vi.mocked(claudeDiscuss).mockResolvedValue({
      type: 'discuss',
      text: 'Claude 토론 메시지',
      usedClaude: true,
    });

    const result = await getAIAction('discuss', baseContext, 'test-api-key', false);
    expect(claudeDiscuss).toHaveBeenCalledWith(baseContext, 'test-api-key');
    expect(result.usedClaude).toBe(true);
  });

  it('vote: claudeVote를 호출한다', async () => {
    vi.mocked(claudeVote).mockResolvedValue({
      type: 'vote',
      targetId: 'player-2',
      usedClaude: true,
    });

    const result = await getAIAction('vote', baseContext, 'test-api-key', false);
    expect(claudeVote).toHaveBeenCalledWith(baseContext, 'test-api-key');
    expect(result.usedClaude).toBe(true);
  });

  it('final_defense: claudeFinalDefense를 호출한다', async () => {
    vi.mocked(claudeFinalDefense).mockResolvedValue({
      type: 'final_defense',
      keyword: '라면',
      usedClaude: true,
    });

    const result = await getAIAction('final_defense', liarContext, 'test-api-key', false);
    expect(claudeFinalDefense).toHaveBeenCalledWith(liarContext, 'test-api-key');
    expect(result.usedClaude).toBe(true);
  });

  it('Claude 실패 시 로컬 AI로 폴백한다', async () => {
    vi.mocked(claudeDescribe).mockRejectedValue(new Error('API 오류'));

    const result = await getAIAction('describe', baseContext, 'bad-api-key', false);
    expect(result.type).toBe('describe');
    expect(result.usedClaude).toBe(false);
  });

  it('Claude 네트워크 오류 시 로컬 AI로 폴백한다', async () => {
    vi.mocked(claudeVote).mockRejectedValue(new TypeError('fetch failed'));

    const result = await getAIAction('vote', baseContext, 'test-api-key', false);
    expect(result.type).toBe('vote');
    expect(result.usedClaude).toBe(false);
  });
});

// ─── 딜레이 동작 ──────────────────────────────────────────────────────────────

describe('getAIAction — 딜레이', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('withDelay=true일 때 randomDelay를 호출한다', async () => {
    await getAIAction('describe', baseContext, undefined, true);
    expect(randomDelay).toHaveBeenCalled();
  });

  it('withDelay=false일 때 randomDelay를 호출하지 않는다', async () => {
    await getAIAction('describe', baseContext, undefined, false);
    expect(randomDelay).not.toHaveBeenCalled();
  });

  it('withDelay 기본값은 true다', async () => {
    await getAIAction('describe', baseContext, undefined);
    expect(randomDelay).toHaveBeenCalled();
  });
});
