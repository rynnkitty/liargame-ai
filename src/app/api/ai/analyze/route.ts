import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { claudeAnalyze } from '@/lib/ai/claude-ai';

const VoteSummarySchema = z.object({
  targetId: z.string(),
  targetName: z.string(),
  count: z.number(),
});

const GameResultSchema = z.object({
  winCondition: z.enum(['citizens_win', 'liar_wins', 'fool_caught', 'fool_missed']),
  liarId: z.string(),
  liarName: z.string(),
  keyword: z.string(),
  voteSummary: z.array(VoteSummarySchema),
  liarGuessedKeyword: z.string().optional(),
  liarGuessCorrect: z.boolean().optional(),
});

const DescriptionSchema = z.object({
  playerId: z.string(),
  playerName: z.string(),
  text: z.string(),
  submittedAt: z.number(),
});

const MessageSchema = z.object({
  id: z.string(),
  playerId: z.string(),
  playerName: z.string(),
  text: z.string(),
  isAI: z.boolean(),
  createdAt: z.number(),
});

const BodySchema = z.object({
  result: GameResultSchema,
  descriptions: z.array(DescriptionSchema),
  messages: z.array(MessageSchema),
  playerNames: z.record(z.string(), z.string()),
});

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey) {
    return NextResponse.json({ error: 'API key required', code: 'INVALID_INPUT' }, { status: 400 });
  }

  try {
    const body = BodySchema.parse(await req.json());
    const response = await claudeAnalyze(
      body.result,
      body.descriptions,
      body.messages,
      body.playerNames,
      apiKey,
    );
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 });
    }
    return NextResponse.json({ error: 'AI failed', code: 'AI_FAILED' }, { status: 500 });
  }
}
