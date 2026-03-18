import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { claudeKeywords } from '@/lib/ai/claude-ai';

const BodySchema = z.object({
  category: z.string().min(1),
  count: z.number().int().min(1).max(20).optional().default(5),
});

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key');
  if (!apiKey) {
    return NextResponse.json({ error: 'API key required', code: 'INVALID_INPUT' }, { status: 400 });
  }

  try {
    const body = BodySchema.parse(await req.json());
    const response = await claudeKeywords(body.category, body.count, apiKey);
    return NextResponse.json(response);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid input', code: 'INVALID_INPUT' }, { status: 400 });
    }
    return NextResponse.json({ error: 'AI failed', code: 'AI_FAILED' }, { status: 500 });
  }
}
