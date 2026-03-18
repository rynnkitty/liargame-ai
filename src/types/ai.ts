import type { Role, Description, Message, Vote, GameResult } from './game';

// ──────────────────────────────────────────────
// AI 컨텍스트 (엔진에 전달되는 게임 상황 정보)
// ──────────────────────────────────────────────
export interface AIContext {
  playerId: string;
  playerName: string;
  role: Role;
  category: string;
  keyword?: string;          // citizen만 보유
  descriptions: Description[];
  messages: Message[];
  votes: Vote[];
  playerNames: string[];     // 전체 플레이어 이름 목록
  playerIds: string[];       // 전체 플레이어 id 목록
}

// ──────────────────────────────────────────────
// AI 액션 타입
// ──────────────────────────────────────────────
export type AIActionType = 'describe' | 'discuss' | 'vote' | 'final_defense';

// ──────────────────────────────────────────────
// AI 요청 (API Route → AI 엔진)
// ──────────────────────────────────────────────
export interface AIDescribeRequest {
  type: 'describe';
  context: AIContext;
  apiKey?: string;
}

export interface AIDiscussRequest {
  type: 'discuss';
  context: AIContext;
  apiKey?: string;
}

export interface AIVoteRequest {
  type: 'vote';
  context: AIContext;
  apiKey?: string;
}

export interface AIFinalDefenseRequest {
  type: 'final_defense';
  context: AIContext;
  apiKey?: string;
}

export interface AIAnalyzeRequest {
  type: 'analyze';
  result: GameResult;
  descriptions: Description[];
  messages: Message[];
  playerNames: Record<string, string>; // id → name
  apiKey?: string;
}

export interface AIKeywordsRequest {
  type: 'keywords';
  category: string;
  count?: number;
  apiKey?: string;
}

export type AIRequest =
  | AIDescribeRequest
  | AIDiscussRequest
  | AIVoteRequest
  | AIFinalDefenseRequest
  | AIAnalyzeRequest
  | AIKeywordsRequest;

// ──────────────────────────────────────────────
// AI 응답
// ──────────────────────────────────────────────
export interface AIDescribeResponse {
  type: 'describe';
  text: string;            // 설명 문장
  usedClaude: boolean;
}

export interface AIDiscussResponse {
  type: 'discuss';
  text: string;            // 토론 메시지
  usedClaude: boolean;
}

export interface AIVoteResponse {
  type: 'vote';
  targetId: string;        // 투표할 플레이어 id
  reason?: string;         // 투표 이유 (선택적 로그용)
  usedClaude: boolean;
}

export interface AIFinalDefenseResponse {
  type: 'final_defense';
  keyword: string;         // 라이어가 추측한 키워드
  usedClaude: boolean;
}

export interface AIAnalyzeResponse {
  type: 'analyze';
  summary: string;         // 전체 요약 (마크다운)
  mvpPlayerId?: string;    // 가장 활약한 플레이어
  highlights: string[];    // 주요 장면 3~5개
  usedClaude: boolean;
}

export interface AIKeywordsResponse {
  type: 'keywords';
  keywords: string[];
  usedClaude: boolean;
}

export type AIResponse =
  | AIDescribeResponse
  | AIDiscussResponse
  | AIVoteResponse
  | AIFinalDefenseResponse
  | AIAnalyzeResponse
  | AIKeywordsResponse;

// ──────────────────────────────────────────────
// API Route 공통 에러 응답
// ──────────────────────────────────────────────
export interface AIErrorResponse {
  error: string;
  code?: 'INVALID_INPUT' | 'AI_FAILED' | 'TIMEOUT' | 'UNKNOWN';
}
