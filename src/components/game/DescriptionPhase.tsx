'use client';

import { useState } from 'react';
import { useRoom } from '@/hooks/useRoom';
import { useGame } from '@/hooks/useGame';
import { useGameStore } from '@/store/game-store';
import Timer from './Timer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Send, Loader2 } from 'lucide-react';

export default function DescriptionPhase() {
  const { room, myPlayerId, currentTurnPlayer, isMyTurn } = useRoom();
  const { myRole, myKeyword } = useGameStore();
  const { submitDescription } = useGame();
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!room) return null;

  const completedCount = room.descriptions.length;
  const totalCount = room.turnOrder.length;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isSubmitting) return;
    setIsSubmitting(true);
    submitDescription(input.trim(), () => {
      setInput('');
      setIsSubmitting(false);
    });
    // 안전 타임아웃
    setTimeout(() => setIsSubmitting(false), 5000);
  };

  return (
    <div className="flex flex-col h-full gap-4 p-4 max-w-2xl mx-auto w-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">설명 단계</h2>
          <p className="text-xs text-muted-foreground">
            {completedCount} / {totalCount} 완료
          </p>
        </div>
        <Timer size="md" />
      </div>

      {/* 진행 바 */}
      <div className="w-full bg-muted/30 rounded-full h-1.5">
        <div
          className="bg-primary h-1.5 rounded-full transition-all duration-500"
          style={{ width: `${(completedCount / Math.max(totalCount, 1)) * 100}%` }}
        />
      </div>

      {/* 내 역할 힌트 */}
      {myRole === 'citizen' && myKeyword && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm flex items-center gap-2">
          <span className="text-muted-foreground">내 키워드:</span>
          <span className="font-bold text-primary">{myKeyword}</span>
        </div>
      )}
      {myRole === 'liar' && (
        <div className="rounded-lg border border-red-500/20 bg-red-950/10 px-3 py-2 text-sm">
          <span className="text-red-400">🎭 라이어 — 다른 설명들을 분석해 그럴듯하게 설명하세요</span>
        </div>
      )}

      {/* 현재 턴 표시 */}
      <div
        className={cn(
          'rounded-xl border p-4 text-center',
          isMyTurn ? 'border-primary/40 bg-primary/10' : 'border-border bg-card/50',
        )}
      >
        {isMyTurn ? (
          <p className="font-semibold text-primary">✨ 당신의 차례입니다!</p>
        ) : (
          <p className="text-muted-foreground text-sm">
            <span className="font-semibold text-foreground">{currentTurnPlayer?.name}</span>
            {currentTurnPlayer?.isAI && (
              <Badge variant="secondary" className="ml-1 text-xs">
                AI
              </Badge>
            )}{' '}
            님이 설명 중...
          </p>
        )}
      </div>

      {/* 설명 목록 */}
      <div className="flex-1 overflow-y-auto space-y-2 min-h-0">
        {room.descriptions.length === 0 ? (
          <div className="text-center text-muted-foreground/50 py-8 text-sm">
            아직 설명이 없습니다
          </div>
        ) : (
          room.descriptions.map((desc, i) => (
            <div
              key={`${desc.playerId}-${desc.submittedAt}`}
              className={cn(
                'rounded-xl border p-3 animate-slide-in-up',
                desc.playerId === myPlayerId
                  ? 'border-primary/30 bg-primary/5'
                  : 'border-border bg-card/50',
              )}
              style={{ animationDelay: `${i * 40}ms` }}
            >
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-semibold text-muted-foreground">{i + 1}.</span>
                <span className="text-sm font-semibold">{desc.playerName}</span>
                {desc.playerId === myPlayerId && (
                  <Badge variant="outline" className="text-xs">
                    나
                  </Badge>
                )}
              </div>
              <p className="text-sm">{desc.text}</p>
            </div>
          ))
        )}
      </div>

      {/* 입력 폼 (내 차례일 때) */}
      {isMyTurn && (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              myRole === 'citizen'
                ? `"${myKeyword}"를 간접적으로 설명하세요`
                : '카테고리에 맞게 그럴듯하게 설명하세요'
            }
            maxLength={100}
            disabled={isSubmitting}
            className="flex-1"
            autoFocus
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
    </div>
  );
}
