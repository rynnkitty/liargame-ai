'use client';

import { useState } from 'react';
import { useRoom } from '@/hooks/useRoom';
import { useGame } from '@/hooks/useGame';
import { useGameStore } from '@/store/game-store';
import Timer from './Timer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Send, Loader2 } from 'lucide-react';

export default function FinalDefense() {
  const { room } = useRoom();
  const { myRole, myCategory } = useGameStore();
  const { submitFinalDefense } = useGame();
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  if (!room) return null;

  const isLiar = myRole === 'liar';
  const liar = room.players.find((p) => p.id === room.liarId);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSubmitting || submitted) return;
    setIsSubmitting(true);
    submitFinalDefense(input.trim());
    setSubmitted(true);
    setIsSubmitting(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 p-4 max-w-md mx-auto w-full">
      {/* 타이머 */}
      <div className="flex flex-col items-center gap-2">
        <Timer size="lg" />
        <p className="text-xs text-muted-foreground">최종 변론</p>
      </div>

      {/* 메인 카드 */}
      <div
        className={cn(
          'w-full rounded-2xl border-2 p-6 text-center',
          isLiar ? 'border-red-500/40 bg-red-950/20' : 'border-border bg-card/50',
        )}
      >
        <div className="text-5xl mb-3">{isLiar ? '🎭' : '⏳'}</div>

        {isLiar ? (
          <>
            <h2 className="font-display text-2xl font-bold text-red-300 mb-2">
              라이어 최후의 기회!
            </h2>
            <p className="text-sm text-muted-foreground mb-1">
              카테고리:{' '}
              <span className="font-semibold text-foreground">{myCategory}</span>
            </p>
            <p className="text-sm text-red-400/80 mb-6">
              키워드를 맞추면 역전승할 수 있습니다
            </p>

            {submitted ? (
              <div className="rounded-xl bg-primary/10 border border-primary/20 p-4">
                <p className="text-sm text-primary font-semibold">답변을 제출했습니다!</p>
                <p className="text-xs text-muted-foreground mt-1">결과를 기다리는 중...</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="flex gap-2">
                <Input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="키워드를 입력하세요..."
                  maxLength={50}
                  disabled={isSubmitting}
                  autoFocus
                  className="flex-1"
                />
                <Button type="submit" disabled={!input.trim() || isSubmitting} size="icon">
                  {isSubmitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                </Button>
              </form>
            )}
          </>
        ) : (
          <>
            <h2 className="font-display text-2xl font-bold mb-2">
              {liar?.name ?? '라이어'}의 최후 변론
            </h2>
            <p className="text-sm text-muted-foreground">
              라이어가 키워드를 맞추려 하고 있습니다...
            </p>
            <p className="text-xs text-muted-foreground/60 mt-2">
              키워드를 맞추면 라이어가 역전승합니다
            </p>
          </>
        )}
      </div>
    </div>
  );
}
