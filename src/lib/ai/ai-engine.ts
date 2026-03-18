/**
 * AI 엔진 통합 인터페이스
 *
 * API 키가 있으면 Claude AI를 시도하고, 없거나 실패하면 로컬 AI로 폴백합니다.
 */
import type {
  AIContext,
  AIActionType,
  AIDescribeResponse,
  AIDiscussResponse,
  AIVoteResponse,
  AIFinalDefenseResponse,
} from '@/types/ai';
import type { Player } from '@/types/game';
import {
  generateAIDescription,
  generateAIMessage,
  generateAIVote,
  generateAIFinalAnswer,
  randomDelay,
} from './local-ai';
import {
  claudeDescribe,
  claudeDiscuss,
  claudeVote,
  claudeFinalDefense,
} from './claude-ai';

type ActionResponse =
  | AIDescribeResponse
  | AIDiscussResponse
  | AIVoteResponse
  | AIFinalDefenseResponse;

// AIContext의 playerIds/playerNames 배열에서 최소 Player 객체 생성
function buildPlayers(context: AIContext): Player[] {
  return context.playerIds.map((id, i) => ({
    id,
    name: context.playerNames[i] ?? id,
    isAI: false,
    isHost: false,
    isConnected: true,
    isReady: true,
  }));
}

function localAction(type: AIActionType, context: AIContext): ActionResponse {
  const players = buildPlayers(context);

  switch (type) {
    case 'describe': {
      const prevTexts = context.descriptions.map((d) => d.text);
      const text = generateAIDescription(
        context.role,
        context.keyword ?? '',
        context.category,
        prevTexts,
      );
      return { type: 'describe', text, usedClaude: false };
    }

    case 'discuss': {
      const text = generateAIMessage(
        context.role,
        context.keyword ?? '',
        context.category,
        context.descriptions,
        context.messages,
        players,
        context.playerId,
      );
      return { type: 'discuss', text, usedClaude: false };
    }

    case 'vote': {
      const targetId = generateAIVote(
        context.playerId,
        context.role,
        players,
        context.descriptions,
      );
      return { type: 'vote', targetId, usedClaude: false };
    }

    case 'final_defense': {
      const keyword = generateAIFinalAnswer(context.category);
      return { type: 'final_defense', keyword, usedClaude: false };
    }
  }
}

/**
 * AI 액션을 실행합니다.
 *
 * @param type   액션 종류 ('describe' | 'discuss' | 'vote' | 'final_defense')
 * @param context 게임 컨텍스트
 * @param apiKey  Claude API 키 (없으면 로컬 AI 사용)
 * @param withDelay 인간처럼 보이는 랜덤 딜레이 적용 여부 (기본 true)
 */
export async function getAIAction(
  type: AIActionType,
  context: AIContext,
  apiKey?: string,
  withDelay = true,
): Promise<ActionResponse> {
  if (withDelay) await randomDelay();

  if (apiKey) {
    try {
      switch (type) {
        case 'describe':
          return await claudeDescribe(context, apiKey);
        case 'discuss':
          return await claudeDiscuss(context, apiKey);
        case 'vote':
          return await claudeVote(context, apiKey);
        case 'final_defense':
          return await claudeFinalDefense(context, apiKey);
      }
    } catch {
      // Claude 실패 → 로컬 폴백
      return localAction(type, context);
    }
  }

  return localAction(type, context);
}
