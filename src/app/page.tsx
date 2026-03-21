'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import CreateRoomForm from '@/components/home/CreateRoomForm';
import JoinRoomForm from '@/components/home/JoinRoomForm';
import ApiKeySettings from '@/components/home/ApiKeySettings';
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { getSocket, connectSocket } from '@/lib/socket/client';
import { useGameStore } from '@/store/game-store';
import { usePlayer } from '@/hooks/usePlayer';

type Tab = 'create' | 'join';

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<Tab>('create');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { setMyPlayerId, setRoom } = useGameStore();
  const { saveSession } = usePlayer();

  const handleCreateRoom = async (data: { roomName: string; nickname: string }) => {
    setIsLoading(true);
    try {
      connectSocket();
      const socket = getSocket();
      socket.emit('room:create', { playerName: data.nickname }, (res) => {
        if (!res.ok) {
          toast({ variant: 'destructive', title: '오류', description: res.error });
          setIsLoading(false);
          return;
        }
        const { room, playerId } = res.data;
        setMyPlayerId(playerId);
        setRoom(room);
        saveSession(data.nickname, playerId);
        router.push(`/room/${room.id}`);
      });
    } catch {
      toast({ variant: 'destructive', title: '오류', description: '방 생성에 실패했습니다.' });
      setIsLoading(false);
    }
  };

  const handleJoinRoom = async (data: { roomCode: string; nickname: string }) => {
    setIsLoading(true);
    try {
      connectSocket();
      const socket = getSocket();
      socket.emit('room:join', { roomCode: data.roomCode, playerName: data.nickname }, (res) => {
        if (!res.ok) {
          toast({ variant: 'destructive', title: '입장 실패', description: res.error });
          setIsLoading(false);
          return;
        }
        const { room, playerId } = res.data;
        setMyPlayerId(playerId);
        setRoom(room);
        saveSession(data.nickname, playerId);
        router.push(`/room/${room.id}`);
      });
    } catch {
      toast({ variant: 'destructive', title: '오류', description: '방 입장에 실패했습니다.' });
      setIsLoading(false);
    }
  };

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center p-4 overflow-hidden">
      {/* 배경 */}
      <div className="fixed inset-0 bg-background">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,hsl(265_55%_20%/0.6),transparent)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_80%_80%,hsl(38_95%_30%/0.08),transparent)]" />
        {/* 격자 텍스처 */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      <div className="relative z-10 w-full max-w-sm mx-auto flex flex-col items-center gap-6">
        {/* ─────────────────────────────────────────────
            로고 영역
            커스텀 이미지로 교체하려면:
              1. /public/logo.png (또는 .svg) 추가
              2. 아래 텍스트 로고 블록을 주석 처리
              3. <Image> 블록 주석 해제 후 사용
            ───────────────────────────────────────────── */}
        <div className="text-center animate-slide-in-up" style={{ animationDelay: '0ms' }}>
          {/*
          import Image from 'next/image';
          <Image
            src="/logo.png"
            alt="LiarGame AI 로고"
            width={200}
            height={64}
            className="mx-auto mb-3"
            priority
          />
          */}

          {/* 텍스트 로고 — 이미지 교체 전 기본 표시 */}
          <div className="flex items-center justify-center gap-2.5 mb-2">
            <img src="/kitty-logo.png" alt="라이어" className="w-12 h-12 object-contain" />
            <h1 className="font-display text-4xl sm:text-5xl text-foreground">
              LiarGame
              <span className="text-primary"> AI</span>
            </h1>
          </div>
          <p className="text-sm text-muted-foreground">AI가 함께하는 실시간 라이어게임</p>
        </div>

        {/* 메인 카드 */}
        <div
          className="w-full rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-slide-in-up"
          style={{ animationDelay: '80ms' }}
        >
          {/* 탭 */}
          <div className="flex border-b border-border">
            {(['create', 'join'] as Tab[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'flex-1 py-3.5 text-sm font-semibold transition-all duration-200 relative',
                  activeTab === tab
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground/70',
                )}
              >
                {tab === 'create' ? '방 만들기' : '방 입장'}
                {activeTab === tab && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t-full" />
                )}
              </button>
            ))}
          </div>

          <div className="p-5">
            {activeTab === 'create' ? (
              <CreateRoomForm onSubmit={handleCreateRoom} isLoading={isLoading} />
            ) : (
              <JoinRoomForm onSubmit={handleJoinRoom} isLoading={isLoading} />
            )}
          </div>
        </div>

        {/* 하단 */}
        <div
          className="flex flex-col items-center gap-3 animate-slide-in-up"
          style={{ animationDelay: '160ms' }}
        >
          <ApiKeySettings />

          <div className="flex items-center gap-3 text-[11px] text-muted-foreground/50">
            <span>2~8명</span>
            <span className="w-px h-3 bg-border" />
            <span>AI 자동 참여</span>
            <span className="w-px h-3 bg-border" />
            <span>링크로 초대</span>
          </div>

          <a href="https://kimkitty.net" target="_blank" rel="noopener noreferrer" className="text-[10px] text-muted-foreground/30 hover:text-muted-foreground/60 transition-colors">KimKitty.NET 2026 · LiarGame AI</a>
        </div>
      </div>
    </main>
  );
}
