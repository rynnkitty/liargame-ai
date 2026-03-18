'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSocket } from '@/hooks/useSocket';
import { useRoom } from '@/hooks/useRoom';
import { useGame } from '@/hooks/useGame';
import { toast } from '@/hooks/use-toast';

// 게임 단계 컴포넌트
import RoleReveal from '@/components/game/RoleReveal';
import DescriptionPhase from '@/components/game/DescriptionPhase';
import DiscussionPhase from '@/components/game/DiscussionPhase';
import VotePhase from '@/components/game/VotePhase';
import FinalDefense from '@/components/game/FinalDefense';

// 결과 컴포넌트
import GameResult from '@/components/result/GameResult';
import AIAnalysis from '@/components/result/AIAnalysis';

// 로비 컴포넌트
import PlayerList from '@/components/lobby/PlayerList';
import AddAIButton from '@/components/lobby/AddAIButton';
import GameSettings from '@/components/lobby/GameSettings';
import RoomCodeShare from '@/components/lobby/RoomCodeShare';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Phase, GameSettings as GameSettingsType } from '@/types/game';

// ── 단계 레이블 ──────────────────────────────────────────
const PHASE_LABEL: Record<Phase, string> = {
  waiting: '대기 중',
  role_reveal: '역할 확인',
  description: '설명',
  discussion: '토론',
  vote: '투표',
  final_defense: '최후 변론',
  result: '결과',
};

// ── 단계 표시 뱃지 ────────────────────────────────────────
function PhaseIndicator({ phase }: { phase: Phase }) {
  if (phase === 'waiting') return null;
  return (
    <Badge variant="outline" className="text-xs font-medium">
      {PHASE_LABEL[phase]}
    </Badge>
  );
}

// ── 대기실 뷰 (인라인) ───────────────────────────────────
function LobbyView() {
  const { room, myPlayerId, isHost } = useRoom();
  const { startGame } = useGame();
  const socket = useSocket();
  const [addingAI, setAddingAI] = useState(false);
  const [starting, setStarting] = useState(false);

  if (!room) return null;

  const aiPlayers = room.players.filter((p) => p.isAI);

  const handleAddAI = () => {
    setAddingAI(true);
    socket.emit('room:add_ai', { roomId: room.id }, (res) => {
      setAddingAI(false);
      if (!res.ok) {
        toast({ variant: 'destructive', title: 'AI 추가 실패', description: res.error });
      }
    });
  };

  const handleKick = (targetPlayerId: string) => {
    socket.emit('room:remove_player', { roomId: room.id, targetPlayerId }, (res) => {
      if (!res.ok) {
        toast({ variant: 'destructive', title: '내보내기 실패', description: res.error });
      }
    });
  };

  const handleUpdateSettings = (partial: Partial<GameSettingsType>) => {
    socket.emit('room:update_settings', { roomId: room.id, settings: partial }, (res) => {
      if (!res.ok) {
        toast({ variant: 'destructive', title: '설정 변경 실패', description: res.error });
      }
    });
  };

  const handleStart = () => {
    setStarting(true);
    startGame((err) => {
      setStarting(false);
      toast({ variant: 'destructive', title: '게임 시작 실패', description: err });
    });
  };

  const minPlayers = 3;
  const canStart = room.players.length >= minPlayers;

  return (
    <div className="flex flex-col gap-4 p-4 max-w-2xl mx-auto w-full pb-8">
      {/* 방 코드 공유 */}
      <RoomCodeShare roomCode={room.code} roomId={room.id} />

      {/* 플레이어 목록 */}
      <div>
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          플레이어 ({room.players.length}/{room.settings.maxPlayers})
        </p>
        <PlayerList
          players={room.players}
          myPlayerId={myPlayerId}
          isHost={isHost}
          onKick={isHost ? handleKick : undefined}
          maxPlayers={room.settings.maxPlayers}
        />
      </div>

      {/* AI 추가 (호스트 전용) */}
      {isHost && (
        <AddAIButton
          onAddAI={handleAddAI}
          currentAICount={aiPlayers.length}
          maxAIPlayers={5}
          totalPlayers={room.players.length}
          maxPlayers={room.settings.maxPlayers}
          isLoading={addingAI}
        />
      )}

      {/* 게임 설정 */}
      <GameSettings settings={room.settings} onUpdate={handleUpdateSettings} isHost={isHost} />

      {/* 게임 시작 버튼 (호스트 전용) */}
      {isHost && (
        <div className="mt-2">
          {!canStart && (
            <p className="text-xs text-muted-foreground text-center mb-2">
              최소 {minPlayers}명이 필요합니다 (현재 {room.players.length}명)
            </p>
          )}
          <Button
            onClick={handleStart}
            disabled={!canStart || starting}
            className="w-full gap-2"
            size="lg"
          >
            {starting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Play className="w-4 h-4" />
            )}
            게임 시작
          </Button>
        </div>
      )}

      {!isHost && (
        <p className="text-center text-xs text-muted-foreground py-2">
          방장이 게임을 시작할 때까지 기다려주세요
        </p>
      )}
    </div>
  );
}

// ── 메인 룸 페이지 ────────────────────────────────────────
export default function RoomPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.roomId as string;

  const socket = useSocket();
  const { room, phase } = useRoom();

  // 잘못된 방 URL이면 홈으로
  useEffect(() => {
    if (room && room.id !== roomId) {
      router.push('/');
    }
  }, [room, roomId, router]);

  // 룸 데이터 없으면 로딩
  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          <p className="text-sm text-muted-foreground">방에 연결 중...</p>
          <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
            홈으로 돌아가기
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* 배경 그라디언트 */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,hsl(265_55%_20%/0.35),transparent)]" />
      </div>

      <div className="relative z-10 flex flex-col min-h-screen">
        {/* ── 헤더 ── */}
        <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-sm border-b border-border/50">
          <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg" aria-hidden>🎭</span>
              <span className="font-display font-bold text-sm">LiarGame AI</span>
            </div>

            <div className="flex items-center gap-2">
              <span
                className={cn(
                  'text-xs bg-muted/30 border border-border rounded px-2 py-0.5',
                  'font-mono tracking-widest text-foreground/80',
                )}
              >
                {room.code}
              </span>
              <PhaseIndicator phase={phase} />
            </div>
          </div>
        </header>

        {/* ── 컨텐츠 ── */}
        <main
          className={cn(
            'flex-1 overflow-y-auto',
            // description / discussion은 높이 100% 레이아웃 사용
            (phase === 'description' || phase === 'discussion') &&
              'flex flex-col',
          )}
        >
          {phase === 'waiting' && <LobbyView />}
          {phase === 'role_reveal' && <RoleReveal />}
          {phase === 'description' && <DescriptionPhase />}
          {phase === 'discussion' && <DiscussionPhase />}
          {phase === 'vote' && <VotePhase />}
          {phase === 'final_defense' && <FinalDefense />}
          {phase === 'result' && (
            <div className="flex flex-col gap-4 pb-8">
              <GameResult />
              <div className="px-4 max-w-2xl mx-auto w-full">
                <AIAnalysis />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
