'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bot, Sparkles, Plus, Loader2 } from 'lucide-react';
import { useSettingsStore } from '@/store/settings-store';
import { cn } from '@/lib/utils';

interface AddAIButtonProps {
  onAddAI: (level: 'local' | 'claude') => void;
  currentAICount: number;
  maxAIPlayers?: number;
  totalPlayers: number;
  maxPlayers?: number;
  isLoading?: boolean;
}

export default function AddAIButton({
  onAddAI,
  currentAICount,
  maxAIPlayers = 5,
  totalPlayers,
  maxPlayers = 8,
  isLoading = false,
}: AddAIButtonProps) {
  const { apiKey } = useSettingsStore();
  const [expanded, setExpanded] = useState(false);

  const hasClaudeKey = apiKey.length > 0 || process.env.NEXT_PUBLIC_HAS_CLAUDE === 'true';
  const canAdd = currentAICount < maxAIPlayers && totalPlayers < maxPlayers;

  if (!canAdd) {
    return (
      <div className="text-center py-2">
        <p className="text-xs text-muted-foreground">
          {totalPlayers >= maxPlayers ? `최대 인원(${maxPlayers}명) 달성` : `AI 최대(${maxAIPlayers}명) 달성`}
        </p>
      </div>
    );
  }

  if (!expanded) {
    return (
      <Button
        variant="outline"
        className="w-full border-dashed gap-2 text-muted-foreground hover:text-foreground hover:border-primary/50"
        onClick={() => setExpanded(true)}
        disabled={isLoading}
      >
        <Plus className="h-4 w-4" />
        AI 플레이어 추가
        <Badge variant="outline" className="ml-auto text-xs">
          {currentAICount}/{maxAIPlayers}
        </Badge>
      </Button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card/50 p-3 space-y-3 animate-slide-in-up">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
        AI 타입 선택
      </p>

      <div className="grid grid-cols-2 gap-2">
        {/* 로컬 AI */}
        <button
          onClick={() => {
            onAddAI('local');
            setExpanded(false);
          }}
          disabled={isLoading}
          className={cn(
            'flex flex-col items-center gap-2 rounded-lg border border-border p-3',
            'hover:border-primary/40 hover:bg-primary/5 transition-all duration-200',
            'text-left disabled:opacity-50 disabled:cursor-not-allowed',
          )}
        >
          <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
            <Bot className="h-4 w-4 text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">로컬 AI</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">API 키 불필요</p>
          </div>
        </button>

        {/* Claude AI */}
        <button
          onClick={() => {
            onAddAI('claude');
            setExpanded(false);
          }}
          disabled={isLoading || !hasClaudeKey}
          className={cn(
            'flex flex-col items-center gap-2 rounded-lg border p-3',
            'transition-all duration-200 text-left',
            hasClaudeKey
              ? 'border-emerald-500/30 hover:border-emerald-400/60 hover:bg-emerald-500/5 cursor-pointer'
              : 'border-border opacity-50 cursor-not-allowed',
          )}
        >
          <div
            className={cn(
              'h-8 w-8 rounded-full flex items-center justify-center',
              hasClaudeKey ? 'bg-emerald-500/20' : 'bg-muted',
            )}
          >
            <Sparkles
              className={cn('h-4 w-4', hasClaudeKey ? 'text-emerald-400' : 'text-muted-foreground')}
            />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Claude AI</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {hasClaudeKey ? 'API 키 연결됨' : 'API 키 필요'}
            </p>
          </div>
        </button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          AI 추가 중...
        </div>
      )}

      <Button
        variant="ghost"
        size="sm"
        className="w-full text-xs text-muted-foreground h-7"
        onClick={() => setExpanded(false)}
      >
        취소
      </Button>
    </div>
  );
}
