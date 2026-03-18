'use client';

import { useGameStore } from '@/store/game-store';
import { useTimer } from '@/hooks/useTimer';
import Timer from './Timer';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Eye, EyeOff } from 'lucide-react';

export default function RoleReveal() {
  const { myRole, myKeyword, myCategory } = useGameStore();
  const { remaining } = useTimer();
  const isLiar = myRole === 'liar';

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-8 px-4 py-8">
      {/* 타이머 */}
      <div className="flex flex-col items-center gap-2">
        <Timer size="lg" />
        <p className="text-xs text-muted-foreground">역할 확인 중</p>
      </div>

      {/* 역할 카드 */}
      <div
        className={cn(
          'w-full max-w-xs rounded-2xl border-2 p-8 text-center',
          'transition-all duration-500 animate-slide-in-up shadow-2xl',
          isLiar
            ? 'border-red-500/40 bg-red-950/20'
            : 'border-primary/40 bg-primary/5',
        )}
      >
        <div className="text-6xl mb-4">{isLiar ? '🎭' : '👁️'}</div>

        <Badge
          className={cn(
            'mb-4 text-sm px-3 py-1',
            isLiar
              ? 'bg-red-500/20 text-red-400 border-red-500/30'
              : 'bg-primary/20 text-primary border-primary/30',
          )}
          variant="outline"
        >
          {isLiar ? '라이어' : '시민'}
        </Badge>

        <h2
          className={cn(
            'font-display text-3xl font-bold mb-4',
            isLiar ? 'text-red-300' : 'text-primary',
          )}
        >
          {isLiar ? '라이어!' : '시민'}
        </h2>

        {isLiar ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <EyeOff className="w-4 h-4" />
              <span className="text-sm">키워드를 모릅니다</span>
            </div>
            <p className="text-xs text-muted-foreground/70">
              카테고리:{' '}
              <span className="font-semibold text-muted-foreground">{myCategory}</span>
            </p>
            <p className="text-xs text-red-400/70">
              다른 플레이어들의 설명을 분석해 키워드를 추측하세요
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-muted-foreground">
              <Eye className="w-4 h-4" />
              <span className="text-sm">카테고리: {myCategory}</span>
            </div>
            <div className="rounded-xl bg-primary/10 border border-primary/20 px-4 py-3">
              <p className="text-xs text-muted-foreground mb-1">키워드</p>
              <p className="font-display text-2xl font-bold text-primary">{myKeyword}</p>
            </div>
            <p className="text-xs text-muted-foreground/70">
              키워드를 직접 말하지 말고 간접적으로 설명하세요
            </p>
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground animate-pulse">
        {remaining}초 후 설명 단계로 이동합니다
      </p>
    </div>
  );
}
