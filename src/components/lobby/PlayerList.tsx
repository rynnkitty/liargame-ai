'use client';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Player } from '@/types/game';
import { Bot, Crown, UserMinus, Wifi, WifiOff } from 'lucide-react';
import { cn } from '@/lib/utils';

// 플레이어 이름 첫 글자로 아바타 배경색 결정
const AVATAR_COLORS = [
  'from-violet-500 to-purple-600',
  'from-amber-400 to-orange-500',
  'from-emerald-400 to-teal-500',
  'from-sky-400 to-blue-500',
  'from-rose-400 to-pink-500',
  'from-indigo-400 to-violet-500',
  'from-lime-400 to-green-500',
  'from-red-400 to-rose-500',
];

function getAvatarColor(name: string, index: number): string {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[(hash + index) % AVATAR_COLORS.length];
}

function getInitials(name: string): string {
  return name.slice(0, 2).toUpperCase();
}

interface PlayerListProps {
  players: Player[];
  myPlayerId?: string | null;
  isHost: boolean;
  onKick?: (playerId: string) => void;
  maxPlayers?: number;
}

export default function PlayerList({
  players,
  myPlayerId,
  isHost,
  onKick,
  maxPlayers = 8,
}: PlayerListProps) {
  // 빈 슬롯 계산
  const emptySlots = Math.max(0, maxPlayers - players.length);

  return (
    <div className="space-y-2">
      {/* 플레이어 목록 */}
      {players.map((player, index) => {
        const isMe = player.id === myPlayerId;
        const canKick = isHost && !isMe && !player.isHost;

        return (
          <div
            key={player.id}
            className={cn(
              'flex items-center gap-3 rounded-xl border p-3 transition-all duration-200 animate-slide-in-up',
              isMe
                ? 'border-primary/30 bg-primary/5'
                : 'border-border bg-card/50 hover:bg-card/80',
            )}
            style={{ animationDelay: `${index * 60}ms` }}
          >
            {/* 아바타 */}
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback
                className={cn(
                  'bg-gradient-to-br text-white font-bold text-sm',
                  getAvatarColor(player.name, index),
                )}
              >
                {player.isAI ? (
                  <Bot className="h-5 w-5" />
                ) : (
                  getInitials(player.name)
                )}
              </AvatarFallback>
            </Avatar>

            {/* 이름 + 뱃지 */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span
                  className={cn(
                    'font-semibold text-sm truncate',
                    isMe ? 'text-primary' : 'text-foreground',
                  )}
                >
                  {player.name}
                </span>

                {isMe && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 shrink-0">
                    나
                  </Badge>
                )}
                {player.isHost && (
                  <Badge variant="host" className="gap-0.5 text-[10px] px-1.5 py-0 h-4 shrink-0">
                    <Crown className="h-2.5 w-2.5" />방장
                  </Badge>
                )}
                {player.isAI && (
                  <Badge variant="ai" className="gap-0.5 text-[10px] px-1.5 py-0 h-4 shrink-0">
                    <Bot className="h-2.5 w-2.5" />
                    {player.aiLevel === 'claude' ? 'Claude' : 'AI'}
                  </Badge>
                )}
              </div>
            </div>

            {/* 우측: 연결 상태 + 킥 버튼 */}
            <div className="flex items-center gap-2 shrink-0">
              {!player.isAI && (
                <span
                  className={cn(
                    'flex items-center',
                    player.isConnected ? 'text-emerald-400' : 'text-muted-foreground',
                  )}
                  title={player.isConnected ? '연결됨' : '연결 끊김'}
                >
                  {player.isConnected ? (
                    <Wifi className="h-3.5 w-3.5" />
                  ) : (
                    <WifiOff className="h-3.5 w-3.5" />
                  )}
                </span>
              )}
              {canKick && onKick && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  onClick={() => onKick(player.id)}
                  title="플레이어 내보내기"
                >
                  <UserMinus className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        );
      })}

      {/* 빈 슬롯 */}
      {Array.from({ length: emptySlots }).map((_, i) => (
        <div
          key={`empty-${i}`}
          className="flex items-center gap-3 rounded-xl border border-dashed border-border/50 p-3 opacity-40"
        >
          <div className="h-10 w-10 rounded-full border-2 border-dashed border-border/60 flex items-center justify-center">
            <span className="text-muted-foreground text-lg">+</span>
          </div>
          <span className="text-sm text-muted-foreground">빈 자리</span>
        </div>
      ))}
    </div>
  );
}
