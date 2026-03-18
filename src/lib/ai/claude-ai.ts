/**
 * Claude API 래퍼
 *
 * - 5초 타임아웃 (AbortSignal)
 * - 실패 시 에러 throw → ai-engine.ts에서 로컬 AI로 폴백
 */
import Anthropic from '@anthropic-ai/sdk';
import { PROMPTS } from './prompts';
import type { AIContext, AIDescribeResponse, AIDiscussResponse, AIVoteResponse, AIFinalDefenseResponse, AIAnalyzeResponse, AIKeywordsResponse } from '@/types/ai';
import type { Description, GameResult, Message } from '@/types/game';

const TIMEOUT_MS = 5_000;

function makeClient(apiKey: string): Anthropic {
  return new Anthropic({ apiKey, timeout: TIMEOUT_MS });
}

async function callClaude(client: Anthropic, prompt: string): Promise<string> {
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 256,
    messages: [{ role: 'user', content: prompt }],
  });

  for (const block of response.content) {
    if (block.type === 'text') return block.text.trim();
  }
  throw new Error('Claude returned empty response');
}

// ─── describe ────────────────────────────────────────────────────────────────

export async function claudeDescribe(
  context: AIContext,
  apiKey: string,
): Promise<AIDescribeResponse> {
  const client = makeClient(apiKey);
  const prevTexts = context.descriptions.map((d) => d.text);

  const prompt =
    context.role === 'citizen'
      ? PROMPTS.describe.citizen(context.keyword ?? '', context.category, prevTexts)
      : PROMPTS.describe.liar(context.category, prevTexts);

  const text = await callClaude(client, prompt);
  return { type: 'describe', text, usedClaude: true };
}

// ─── discuss ─────────────────────────────────────────────────────────────────

export async function claudeDiscuss(
  context: AIContext,
  apiKey: string,
): Promise<AIDiscussResponse> {
  const client = makeClient(apiKey);
  const descObjs = context.descriptions.map((d) => ({
    playerName: d.playerName,
    text: d.text,
  }));
  const msgObjs = context.messages.map((m) => ({
    playerName: m.playerName,
    text: m.text,
  }));

  const prompt =
    context.role === 'citizen'
      ? PROMPTS.discuss.citizen(context.keyword ?? '', context.category, descObjs, msgObjs)
      : PROMPTS.discuss.liar(context.category, descObjs, msgObjs);

  const text = await callClaude(client, prompt);
  return { type: 'discuss', text, usedClaude: true };
}

// ─── vote ─────────────────────────────────────────────────────────────────────

export async function claudeVote(
  context: AIContext,
  apiKey: string,
): Promise<AIVoteResponse> {
  const client = makeClient(apiKey);
  // 자신 제외 후보
  const candidates = context.playerIds
    .map((id, i) => ({ id, name: context.playerNames[i] ?? id }))
    .filter((p) => p.id !== context.playerId);

  const descObjs = context.descriptions.map((d) => ({
    playerId: d.playerId,
    playerName: d.playerName,
    text: d.text,
  }));

  const prompt = PROMPTS.vote(
    context.role,
    context.keyword,
    context.category,
    descObjs,
    candidates.map((c) => c.name),
  );

  const rawName = await callClaude(client, prompt);

  // 응답에서 플레이어 이름 매핑
  const matched = candidates.find(
    (c) => rawName.includes(c.name) || c.name.includes(rawName),
  );
  const targetId = matched?.id ?? candidates[Math.floor(Math.random() * candidates.length)].id;

  return { type: 'vote', targetId, reason: rawName, usedClaude: true };
}

// ─── finalDefense ─────────────────────────────────────────────────────────────

export async function claudeFinalDefense(
  context: AIContext,
  apiKey: string,
): Promise<AIFinalDefenseResponse> {
  const client = makeClient(apiKey);
  const descObjs = context.descriptions.map((d) => ({
    playerName: d.playerName,
    text: d.text,
  }));

  const prompt = PROMPTS.finalDefense(context.category, descObjs);
  const keyword = await callClaude(client, prompt);
  return { type: 'final_defense', keyword, usedClaude: true };
}

// ─── analyze ──────────────────────────────────────────────────────────────────

export async function claudeAnalyze(
  result: GameResult,
  descriptions: Description[],
  messages: Message[],
  playerNames: Record<string, string>,
  apiKey: string,
): Promise<AIAnalyzeResponse> {
  const client = makeClient(apiKey);

  const descObjs = descriptions.map((d) => ({ playerName: d.playerName, text: d.text }));
  const msgObjs = messages.map((m) => ({ playerName: m.playerName, text: m.text }));

  const winConditionLabel: Record<string, string> = {
    citizens_win: '시민 승리',
    liar_wins: '라이어 승리',
    fool_caught: '바보 승리',
    fool_missed: '시민 승리',
  };

  const prompt = PROMPTS.analyze(
    winConditionLabel[result.winCondition] ?? result.winCondition,
    result.liarName,
    result.keyword,
    descObjs,
    msgObjs,
    result.liarGuessedKeyword,
  );

  // 분석은 응답이 길 수 있으므로 max_tokens를 늘림
  const response = await client.messages.create({
    model: 'claude-haiku-4-5',
    max_tokens: 1024,
    messages: [{ role: 'user', content: prompt }],
  });

  let summary = '';
  for (const block of response.content) {
    if (block.type === 'text') {
      summary = block.text.trim();
      break;
    }
  }

  if (!summary) throw new Error('Claude returned empty analysis');

  // MVP 이름 추출: 플레이어 이름 중 첫 번째로 등장하는 이름
  const allNames = Object.values(playerNames);
  const mvpName = allNames.find((name) => summary.includes(name));
  const mvpPlayerId = mvpName
    ? Object.entries(playerNames).find(([, n]) => n === mvpName)?.[0]
    : undefined;

  // 하이라이트: 숫자 bullet 줄 추출
  const highlights = summary
    .split('\n')
    .filter((line) => /^[-•*]|^\d+\./.test(line.trim()))
    .map((line) => line.replace(/^[-•*\d.]+\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 5);

  return {
    type: 'analyze',
    summary,
    mvpPlayerId,
    highlights,
    usedClaude: true,
  };
}

// ─── keywords ─────────────────────────────────────────────────────────────────

export async function claudeKeywords(
  category: string,
  count: number,
  apiKey: string,
): Promise<AIKeywordsResponse> {
  const client = makeClient(apiKey);
  const prompt = PROMPTS.keywords(category, count);
  const raw = await callClaude(client, prompt);

  const keywords = raw
    .split(/[,，、]/)
    .map((k) => k.trim().replace(/^["'"']|["'"']$/g, ''))
    .filter(Boolean)
    .slice(0, count);

  if (keywords.length === 0) throw new Error('Claude returned no keywords');

  return { type: 'keywords', keywords, usedClaude: true };
}
