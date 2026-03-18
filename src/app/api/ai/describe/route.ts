import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getAIAction } from '@/lib/ai/ai-engine';
import type { AIContext } from '@/types/ai';

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

const VoteSchema = z.object({
  voterId: z.string(),
  targetId: z.string(),
});

const ContextSchema = z.object({
  playerId: z.string(),
  playerName: z.string(),
  role: z.enum(['citizen', 'liar']),
  category: z.string(),
  keyword: z.string().optional(),
  descriptions: z.array(DescriptionSchema),
  messages: z.array(MessageSchema),
  votes: z.array(VoteSchema),
  playerNames: z.array(z.string()),
  playerIds: z.array(z.string()),
});

const BodySchema = z.object({
  context: ContextSchema,
});

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey) {
    return NextResponse.json({ error: 'API key required', code: 'INVALID_INPUT' }, { status: 400 });
  }

  try {
    const body = BodySchema.parse(await req.json());
    const context = body.context as AIContext;
    const result = await getAIAction('describe', context, apiKey, false);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 });
    }
    return NextResponse.json({ error: 'AI failed', code: 'AI_FAILED' }, { status: 500 });
  }
}
