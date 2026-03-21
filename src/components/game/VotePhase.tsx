'use client';

import { useState } from 'react';
import { useRoom } from '@/hooks/useRoom';
import { useGame } from '@/hooks/useGame';
import { useGameStore } from '@/store/game-store';
import Timer from './Timer';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CheckCircle2, Bot } from 'lucide-react';

export default function VotePhase() {
  const { room, myPlayerId } = useRoom();
  const { myRole } = useGameStore();
  const { submitVote } = useGame();
  const [pending, setPending] = useState<string | null>(null);

  if (!room) return null;

  const myVote = room.votes.find((v) => v.voterId === myPlayerId);
  const hasVoted = !!myVote;

  const getVoteCount = (playerId: string) =>
    room.votes.filter((v) => v.targetId === playerId).length;

  const totalVotes = room.votes.length;
  const totalPlayers = room.players.length;

  const handleVote = (targetId: string) => {
    if (hasVoted || targetId === myPlayerId) return;
    setPending(targetId);
    submitVote(targetId);
  };

  return (
    <div className="flex flex-col gap-4 p-4 max-w-2xl mx-auto w-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">투표 단계</h2>
          <p className="text-xs text-muted-foreground">
            {totalVotes} / {totalPlayers} 투표 완료
          </p>
        </div>
        <Timer size="md" />
      </div>

      {/* 역할 힌트 */}
      <div
        className={cn(
          'rounded-lg border px-3 py-2 text-xs',
          myRole === 'citizen'
            ? 'border-primary/20 bg-primary/5 text-primary/80'
            : 'border-red-500/20 bg-red-950/10 text-red-400',
        )}
      >
        {myRole === 'citizen'
          ? '🔍 라이어라고 생각하는 플레이어에게 투표하세요'
          : '🎭 라이어 — 의심을 피하세요'}
      </div>

      {/* 설명 요약 */}
      {room.descriptions.length > 0 && (
        <div className="rounded-xl border border-border bg-card/30 p-3 space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground mb-2">설명 요약</p>
          {room.descriptions.map((desc, i) => (
            <div key={`${desc.playerId}-${i}`} className="flex gap-2 text-xs">
              <span className="font-semibold text-muted-foreground shrink-0 w-16 truncate">
                {desc.playerName}
              </span>
              <span className="text-foreground/80">{desc.text}</span>
            </div>
          ))}
        </div>
      )}

      {/* 플레이어 카드 그리드 */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {room.players.map((player, index) => {
          const isMe = player.id === myPlayerId;
          const isVotedByMe = myVote?.targetId === player.id;
          const votes = getVoteCount(player.id);
          const canVote = !hasVoted && !isMe;

          return (
            <button
              key={player.id}
              onClick={() => canVote && handleVote(player.id)}
              disabled={!canVote}
              className={cn(
                'relative rounded-2xl border p-4 text-center transition-all duration-200',
                'flex flex-col items-center gap-2',
                canVote &&
                  'hover:border-primary/50 hover:bg-primary/5 cursor-pointer active:scale-95',
                isVotedByMe && 'border-primary bg-primary/10',
                isMe && 'border-border/50 opacity-50 cursor-not-allowed',
                !canVote && !isMe && 'cursor-default',
                pending === player.id && !isVotedByMe && 'animate-pulse',
              )}
              style={{ animationDelay: `${index * 50}ms` }}
            >
              {/* 투표 수 뱃지 */}
              {votes > 0 && (
                <span className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center z-10">
                  {votes}
                </span>
              )}

              {/* 아바타 */}
              <div
                className={cn(
                  'w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold',
                  'bg-muted text-muted-foreground',
                  isVotedByMe && 'bg-primary/20 text-primary',
                )}
              >
                {player.isAI ? <Bot className="w-6 h-6" /> : player.name[0].toUpperCase()}
              </div>

              {/* 이름 */}
              <div className="space-y-0.5 w-full">
                <p className="text-sm font-semibold truncate">{player.name}</p>
                <div className="flex items-center justify-center gap-1">
                  {isMe && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-3.5">
                      나
                    </Badge>
                  )}
                  {player.isAI && (
                    <Badge variant="secondary" className="text-[10px] px-1 py-0 h-3.5">
                      AI
                    </Badge>
                  )}
                </div>
              </div>

              {/* 투표 완료 표시 */}
              {isVotedByMe && (
                <div className="flex items-center gap-1 text-primary text-xs font-semibold">
                  <CheckCircle2 className="w-3 h-3" />
                  투표함
                </div>
              )}
            </button>
          );
        })}
      </div>

      {hasVoted && (
        <p className="text-center text-sm text-muted-foreground animate-pulse">
          다른 플레이어들의 투표를 기다리는 중...
        </p>
      )}
    </div>
  );
}
