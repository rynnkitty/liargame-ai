'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Copy, Check, Link, QrCode } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RoomCodeShareProps {
  roomCode: string;
  roomId: string;
}

export default function RoomCodeShare({ roomCode, roomId }: RoomCodeShareProps) {
  const [codeCopied, setCodeCopied] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

  const getRoomUrl = () => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/room/${roomId}`;
  };

  const copyCode = async () => {
    try {
      await navigator.clipboard.writeText(roomCode);
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
      toast({ title: '방 코드 복사됨', description: `"${roomCode}" 코드를 친구에게 알려주세요.` });
    } catch {
      toast({ variant: 'destructive', title: '복사 실패', description: '수동으로 코드를 복사해주세요.' });
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(getRoomUrl());
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
      toast({ title: '링크 복사됨', description: '친구에게 링크를 공유하세요.' });
    } catch {
      toast({ variant: 'destructive', title: '복사 실패', description: '수동으로 링크를 복사해주세요.' });
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card/50 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          방 코드 공유
        </p>
      </div>

      {/* 방 코드 큰 표시 */}
      <div className="relative">
        <div className="flex items-center gap-1 bg-muted/40 rounded-lg px-4 py-3 border border-border/50">
          {roomCode.split('').map((char, i) => (
            <span
              key={i}
              className="flex-1 text-center text-2xl font-black font-mono tracking-wider text-foreground"
            >
              {char}
            </span>
          ))}
        </div>
        <button
          onClick={copyCode}
          className={cn(
            'absolute right-2.5 top-1/2 -translate-y-1/2',
            'h-8 w-8 rounded-md flex items-center justify-center',
            'text-muted-foreground hover:text-foreground hover:bg-muted transition-all duration-200',
          )}
          title="코드 복사"
        >
          {codeCopied ? (
            <Check className="h-4 w-4 text-emerald-400" />
          ) : (
            <Copy className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* 링크 공유 버튼 */}
      <Button
        variant="outline"
        size="sm"
        className="w-full gap-2 text-xs"
        onClick={copyLink}
      >
        {linkCopied ? (
          <>
            <Check className="h-3.5 w-3.5 text-emerald-400" />
            링크 복사됨!
          </>
        ) : (
          <>
            <Link className="h-3.5 w-3.5" />
            초대 링크 복사
          </>
        )}
      </Button>

      <p className="text-[10px] text-muted-foreground text-center">
        코드나 링크를 친구에게 공유하면 바로 입장할 수 있어요
      </p>
    </div>
  );
}
