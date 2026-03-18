'use client';

import { useState, useRef, useEffect } from 'react';
import { useRoom } from '@/hooks/useRoom';
import { useGame } from '@/hooks/useGame';
import { useGameStore } from '@/store/game-store';
import Timer from './Timer';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Send } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function DiscussionPhase() {
  const { room, myPlayerId } = useRoom();
  const { myRole, myKeyword } = useGameStore();
  const { sendMessage } = useGame();
  const [input, setInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [room?.messages.length]);

  if (!room) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput('');
  };

  return (
    <div className="flex flex-col h-full gap-3 p-4 max-w-2xl mx-auto w-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">토론 단계</h2>
          <p className="text-xs text-muted-foreground">라이어를 찾아보세요</p>
        </div>
        <Timer size="md" />
      </div>

      {/* 역할 힌트 */}
      {myRole && (
        <div
          className={cn(
            'rounded-lg border px-3 py-2 text-xs',
            myRole === 'citizen'
              ? 'border-primary/20 bg-primary/5 text-primary/80'
              : 'border-red-500/20 bg-red-950/10 text-red-400',
          )}
        >
          {myRole === 'citizen'
            ? `🔑 키워드: ${myKeyword} — 라이어의 의심스러운 설명을 찾아보세요`
            : '🎭 라이어 — 자연스럽게 대화하며 의심을 피하세요'}
        </div>
      )}

      {/* 메시지 목록 */}
      <div className="flex-1 overflow-y-auto space-y-3 min-h-0 pb-1">
        {room.messages.length === 0 ? (
          <div className="text-center text-muted-foreground/50 py-8 text-sm">
            아직 메시지가 없습니다. 먼저 이야기를 시작해 보세요!
          </div>
        ) : (
          room.messages.map((msg) => {
            const isMe = msg.playerId === myPlayerId;
            return (
              <div
                key={msg.id}
                className={cn(
                  'flex gap-2 animate-slide-in-up',
                  isMe ? 'flex-row-reverse' : 'flex-row',
                )}
              >
                {/* 아바타 */}
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1 bg-muted text-muted-foreground">
                  {msg.isAI ? '🤖' : msg.playerName[0].toUpperCase()}
                </div>

                <div className={cn('flex flex-col gap-0.5 max-w-[75%]', isMe && 'items-end')}>
                  <div className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground font-medium">
                      {msg.playerName}
                    </span>
                    {msg.isAI && (
                      <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                        AI
                      </Badge>
                    )}
                  </div>
                  <div
                    className={cn(
                      'rounded-2xl px-3 py-2 text-sm',
                      isMe
                        ? 'bg-primary text-primary-foreground rounded-tr-sm'
                        : 'bg-card border border-border rounded-tl-sm',
                    )}
                  >
                    {msg.text}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* 입력 */}
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="메시지를 입력하세요..."
          maxLength={200}
          className="flex-1"
        />
        <Button type="submit" disabled={!input.trim()} size="icon">
          <Send className="w-4 h-4" />
        </Button>
      </form>
    </div>
  );
}
