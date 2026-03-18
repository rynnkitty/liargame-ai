import { GameMode, Player, Role, Vote, WinCondition } from '@/types/game';
import { KEYWORDS } from '@/constants/keywords';

// ─── 반환 타입 ────────────────────────────────────────────────────────────────

export interface AssignedPlayer extends Player {
  role: Role;
}

export interface KeywordResult {
  /** 시민 키워드 */
  keyword: string;
  /** 바보 모드에서 바보(라이어)에게 주어지는 다른 키워드 */
  foolKeyword?: string;
}

export interface TallyResult {
  /** 최다 득표자 ID. 동률이면 null */
  mostVotedId: string | null;
  isTie: boolean;
  /** targetId → 득표수 */
  counts: Record<string, number>;
}

// ─── 내부 헬퍼 ────────────────────────────────────────────────────────────────

function randomInt(max: number): number {
  return Math.floor(Math.random() * max);
}

// ─── 순수 함수 ────────────────────────────────────────────────────────────────

/**
 * 플레이어 목록에서 라이어 한 명을 무작위로 선택하고 역할을 배정합니다.
 * - liar 모드: 라이어 1명 + 나머지 시민
 * - fool 모드: 바보(라이어) 1명 + 나머지 시민 (역할 구조는 동일)
 */
export function assignRoles(players: Player[], _mode: GameMode): AssignedPlayer[] {
  if (players.length < 2) {
    throw new Error('최소 2명의 플레이어가 필요합니다');
  }

  const liarIndex = randomInt(players.length);

  return players.map((player, i): AssignedPlayer => ({
    ...player,
    role: i === liarIndex ? 'liar' : 'citizen',
  }));
}

/**
 * 카테고리에서 키워드를 무작위 선택합니다.
 * - liar 모드: 단일 키워드
 * - fool 모드: 시민 키워드 + 바보에게 줄 다른 키워드 쌍
 */
export function selectKeyword(category: string, mode: GameMode): KeywordResult {
  const list = KEYWORDS[category];
  if (!list || list.length === 0) {
    throw new Error(`알 수 없는 카테고리: ${category}`);
  }

  const keyword = list[randomInt(list.length)];

  if (mode === 'fool') {
    if (list.length < 2) {
      throw new Error(`바보 모드에는 카테고리에 키워드가 2개 이상 필요합니다: ${category}`);
    }
    const remaining = list.filter((k) => k !== keyword);
    const foolKeyword = remaining[randomInt(remaining.length)];
    return { keyword, foolKeyword };
  }

  return { keyword };
}

/**
 * 플레이어 목록을 무작위 순서로 섞어 ID 배열로 반환합니다 (Fisher-Yates).
 */
export function shuffleTurnOrder(players: Player[]): string[] {
  const ids = players.map((p) => p.id);

  for (let i = ids.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }

  return ids;
}

/**
 * 투표를 집계하여 최다 득표자와 동률 여부를 반환합니다.
 * 동률이면 mostVotedId는 null입니다.
 */
export function tallyVotes(votes: Vote[]): TallyResult {
  const counts: Record<string, number> = {};

  for (const vote of votes) {
    counts[vote.targetId] = (counts[vote.targetId] ?? 0) + 1;
  }

  const entries = Object.entries(counts);
  if (entries.length === 0) {
    return { mostVotedId: null, isTie: false, counts };
  }

  const maxCount = Math.max(...entries.map(([, c]) => c));
  const topVoted = entries.filter(([, c]) => c === maxCount).map(([id]) => id);

  if (topVoted.length > 1) {
    return { mostVotedId: null, isTie: true, counts };
  }

  return { mostVotedId: topVoted[0], isTie: false, counts };
}

/**
 * 게임 승패를 판정합니다.
 *
 * liar 모드:
 *   - 라이어 미지목 (mostVotedId !== liarId) → liar_wins
 *   - 라이어 지목 + 정답 불일치 → citizens_win
 *   - 라이어 지목 + 정답 일치    → liar_wins (역전)
 *
 * fool 모드:
 *   - 바보 지목 (mostVotedId === liarId) → fool_caught (바보 승)
 *   - 바보 미지목                         → fool_missed (시민 승)
 */
export function determineWinner(
  mode: GameMode,
  liarId: string,
  mostVotedId: string | null,
  liarGuess: string | undefined,
  keyword: string,
): WinCondition {
  if (mode === 'fool') {
    return mostVotedId === liarId ? 'fool_caught' : 'fool_missed';
  }

  // liar 모드
  if (mostVotedId !== liarId) {
    return 'liar_wins';
  }

  // 라이어 지목됨 → final_defense 결과 확인
  if (liarGuess !== undefined && liarGuess.trim() === keyword.trim()) {
    return 'liar_wins';
  }

  return 'citizens_win';
}
