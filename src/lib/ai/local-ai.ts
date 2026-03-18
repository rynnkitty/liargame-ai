import {
  CITIZEN_DESCRIPTION_TEMPLATES,
  LIAR_DESCRIPTION_TEMPLATES,
  DISCUSSION_TEMPLATES,
  FINAL_DEFENSE_GUESS_TEMPLATES,
  fillTemplate,
} from '@/constants/ai-templates';
import type { Role, Description, Message, Player } from '@/types/game';

// ─── 내부 헬퍼 ────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const DEFAULT_TEMPLATES = [
  '꽤 특별한 느낌이에요.',
  '독특한 특징이 있습니다.',
  '다들 알 것 같아요.',
  '이야기하기 좀 어렵네요.',
];

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * AI 플레이어의 설명을 생성합니다.
 * - citizen: 카테고리별 간접 묘사 템플릿
 * - liar: 키워드 없이 그럴듯한 범용 묘사
 */
export function generateAIDescription(
  role: Role,
  _keyword: string,
  category: string,
  prevDescriptions: string[],
): string {
  if (role === 'liar') {
    const templates = LIAR_DESCRIPTION_TEMPLATES[category] ?? DEFAULT_TEMPLATES;
    // 이미 사용된 템플릿 피하기
    const unused = templates.filter((t) => !prevDescriptions.includes(t));
    return pick(unused.length > 0 ? unused : templates);
  }

  const templates = CITIZEN_DESCRIPTION_TEMPLATES[category] ?? DEFAULT_TEMPLATES;
  const unused = templates.filter((t) => !prevDescriptions.includes(t));
  return pick(unused.length > 0 ? unused : templates);
}

/**
 * AI 플레이어의 토론 메시지를 생성합니다.
 * - liar: 다른 플레이어를 의심하거나 연막을 침
 * - citizen: 의심하거나 변호하거나 중립 발언
 */
export function generateAIMessage(
  role: Role,
  _keyword: string,
  _category: string,
  _descriptions: Description[],
  _messages: Message[],
  players: Player[],
  selfId: string,
): string {
  const others = players.filter((p) => p.id !== selfId);
  if (others.length === 0) return pick(DISCUSSION_TEMPLATES.neutral);

  const target = pick(others);

  if (role === 'liar') {
    const type = Math.random() < 0.6 ? 'distract' : 'agree';
    return fillTemplate(pick(DISCUSSION_TEMPLATES[type]), { name: target.name });
  }

  const rand = Math.random();
  if (rand < 0.45) {
    return fillTemplate(pick(DISCUSSION_TEMPLATES.suspicion), { name: target.name });
  } else if (rand < 0.7) {
    return pick(DISCUSSION_TEMPLATES.defense);
  } else {
    return pick(DISCUSSION_TEMPLATES.neutral);
  }
}

/**
 * AI 플레이어의 투표 대상을 결정합니다.
 * - liar: 시민 중 무작위 선택 (자신 제외)
 * - citizen: 설명 길이 기반 단순 휴리스틱 (짧고 모호한 설명 → 의심)
 */
export function generateAIVote(
  selfId: string,
  role: Role,
  players: Player[],
  descriptions: Description[],
): string {
  const candidates = players.filter((p) => p.id !== selfId);
  if (candidates.length === 0) return selfId;

  if (role === 'liar') {
    // 라이어는 시민 중 누군가를 지목 (자신이 의심받지 않도록)
    const nonLiar = candidates.filter((p) => p.role !== 'liar');
    return pick(nonLiar.length > 0 ? nonLiar : candidates).id;
  }

  // 시민: 평균보다 짧은 설명을 한 사람을 의심
  if (descriptions.length > 0) {
    const avgLen =
      descriptions.reduce((sum, d) => sum + d.text.length, 0) / descriptions.length;

    const suspicious = descriptions
      .filter((d) => d.playerId !== selfId && d.text.length < avgLen * 0.75)
      .map((d) => d.playerId);

    if (suspicious.length > 0) return pick(suspicious);
  }

  return pick(candidates).id;
}

/**
 * 라이어 AI의 최종 변론 정답 추측을 생성합니다.
 * 카테고리별 대표 키워드 중 하나를 무작위 선택합니다.
 */
export function generateAIFinalAnswer(category: string): string {
  const guesses = FINAL_DEFENSE_GUESS_TEMPLATES[category];
  if (guesses && guesses.length > 0) return pick(guesses);
  return '모르겠어요';
}

/**
 * AI 행동 전 인간처럼 보이도록 2~5초 랜덤 딜레이를 줍니다.
 */
export function randomDelay(minMs = 2000, maxMs = 5000): Promise<void> {
  const ms = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
  return new Promise((resolve) => setTimeout(resolve, ms));
}
