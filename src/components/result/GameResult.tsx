'use client';

import { useRoom } from '@/hooks/useRoom';
import { useGame } from '@/hooks/useGame';
import { useGameStore } from '@/store/game-store';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Bot, RotateCcw, Skull } from 'lucide-react';
import type { WinCondition } from '@/types/game';

const WIN_INFO: Record<WinCondition, { label: string; emoji: string; citizenWins: boolean }> = {
  citizens_win: { label: '시민 승리', emoji: '🎉', citizenWins: true },
  liar_wins: { label: '라이어 승리', emoji: '🎭', citizenWins: false },
  fool_caught: { label: '바보 승리', emoji: '🤡', citizenWins: false },
  fool_missed: { label: '시민 승리', emoji: '🎉', citizenWins: true },
};

export default function GameResult() {
  const { room, myPlayerId, isHost } = useRoom();
  const { myRole } = useGameStore();
  const { playAgain } = useGame();

  if (!room?.gameResult) return null;

  const result = room.gameResult;
  const info = WIN_INFO[result.winCondition];
  const isMyWin =
    (info.citizenWins && myRole === 'citizen') || (!info.citizenWins && myRole === 'liar');
  const maxVotes = Math.max(...result.voteSummary.map((v) => v.count), 1);

  return (
    <div className="flex flex-col gap-5 p-4 max-w-2xl mx-auto w-full pb-8">
      {/* 승패 헤더 */}
      <div
        className={cn(
          'rounded-2xl border-2 p-6 text-center animate-slide-in-up',
          isMyWin ? 'border-amber-400/40 bg-amber-950/20' : 'border-border bg-card/50',
        )}
      >
        <div className="text-6xl mb-3">{info.emoji}</div>
        <h2
          className={cn(
            'text-2xl font-semibold mb-1',
            isMyWin ? 'text-amber-300' : 'text-muted-foreground',
          )}
        >
          {info.label}
        </h2>
        <p className="text-sm text-muted-foreground">
          {isMyWin ? '🏆 당신이 이겼습니다!' : '아쉽지만 다음 기회에!'}
        </p>
      </div>

      {/* 키워드 공개 */}
      <div
        className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-center animate-slide-in-up"
        style={{ animationDelay: '60ms' }}
      >
        <p className="text-xs text-muted-foreground mb-1">이번 게임의 키워드</p>
        <p className="text-2xl font-semibold text-primary tracking-wide">{result.keyword}</p>
        {result.liarGuessedKeyword && (
          <p className="text-xs text-muted-foreground mt-2">
            라이어의 추측:{' '}
            <span
              className={cn(
                'font-semibold',
                result.liarGuessCorrect ? 'text-green-400' : 'text-destructive',
              )}
            >
              {result.liarGuessedKeyword}
            </span>{' '}
            {result.liarGuessCorrect ? '✓ 정답' : '✗ 오답'}
          </p>
        )}
      </div>

      {/* 라이어 공개 */}
      <div
        className="rounded-xl border border-red-500/20 bg-red-950/10 p-4 animate-slide-in-up"
        style={{ animationDelay: '100ms' }}
      >
        <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
          <Skull className="w-3 h-3" /> 라이어
        </p>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-xl">
            🎭
          </div>
          <span className="font-semibold text-lg">{result.liarName}</span>
        </div>
      </div>

      {/* 투표 결과 */}
      {result.voteSummary.length > 0 && (
        <div className="animate-slide-in-up" style={{ animationDelay: '140ms' }}>
          <p className="text-xs font-semibold text-muted-foreground mb-2">투표 결과</p>
          <div className="space-y-2">
            {[...result.voteSummary]
              .sort((a, b) => b.count - a.count)
              .map((v) => {
                const isLiarRow = v.targetId === result.liarId;
                return (
                  <div key={v.targetId} className="flex items-center gap-3">
                    <span
                      className={cn(
                        'text-sm font-medium w-20 truncate shrink-0',
                        isLiarRow ? 'text-red-400' : 'text-foreground',
                      )}
                    >
                      {v.targetName}
                      {isLiarRow && ' 🎭'}
                    </span>
                    <div className="flex-1 bg-muted/30 rounded-full h-2 overflow-hidden">
                      <div
                        className={cn(
                          'h-2 rounded-full transition-all duration-700',
                          isLiarRow ? 'bg-red-400' : 'bg-muted-foreground/40',
                        )}
                        style={{ width: `${(v.count / maxVotes) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-4 text-right shrink-0">
                      {v.count}
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* 플레이어 역할 공개 */}
      <div className="animate-slide-in-up" style={{ animationDelay: '180ms' }}>
        <p className="text-xs font-semibold text-muted-foreground mb-2">플레이어 역할</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {room.players.map((player) => {
            const isLiarPlayer = player.id === result.liarId;
            const isMe = player.id === myPlayerId;
            return (
              <div
                key={player.id}
                className={cn(
                  'rounded-xl border p-3 text-center',
                  isLiarPlayer ? 'border-red-500/30 bg-red-950/10' : 'border-border bg-card/50',
                )}
              >
                <div className="text-2xl mb-1">{isLiarPlayer ? '🎭' : '👁️'}</div>
                <p className="text-sm font-semibold truncate">{player.name}</p>
                <div className="flex items-center justify-center gap-1 mt-0.5 flex-wrap">
                  {isMe && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-3.5">
                      나
                    </Badge>
                  )}
                  {player.isAI && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 h-3.5">
                      <Bot className="w-2 h-2" />
                    </Badge>
                  )}
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] px-1 py-0 h-3.5',
                      isLiarPlayer
                        ? 'border-red-500/40 text-red-400'
                        : 'border-primary/40 text-primary',
                    )}
                  >
                    {isLiarPlayer ? '라이어' : '시민'}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 다시하기 */}
      <div className="animate-slide-in-up" style={{ animationDelay: '220ms' }}>
        {isHost ? (
          <Button onClick={playAgain} className="w-full gap-2" size="lg">
            <RotateCcw className="w-4 h-4" />
            다시 하기
          </Button>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            방장이 다음 게임을 시작할 때까지 기다려주세요
          </p>
        )}
      </div>
    </div>
  );
}
