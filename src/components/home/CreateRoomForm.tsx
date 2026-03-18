'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, Sparkles } from 'lucide-react';

interface CreateRoomFormProps {
  onSubmit: (data: { roomName: string; nickname: string }) => void;
  isLoading?: boolean;
}

export default function CreateRoomForm({ onSubmit, isLoading = false }: CreateRoomFormProps) {
  const [roomName, setRoomName] = useState('');
  const [nickname, setNickname] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomName.trim() || !nickname.trim()) return;
    onSubmit({ roomName: roomName.trim(), nickname: nickname.trim() });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="roomName">방 이름</Label>
        <Input
          id="roomName"
          value={roomName}
          onChange={(e) => setRoomName(e.target.value)}
          placeholder="우리 팀 라이어게임"
          maxLength={20}
          required
          disabled={isLoading}
          autoComplete="off"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="create-nickname">닉네임</Label>
        <Input
          id="create-nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="플레이어 이름"
          maxLength={12}
          required
          disabled={isLoading}
          autoComplete="off"
        />
        <p className="text-xs text-muted-foreground">최대 12자</p>
      </div>

      <Button
        type="submit"
        className="w-full h-12 text-base font-bold tracking-wide"
        disabled={isLoading || !roomName.trim() || !nickname.trim()}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            방 만드는 중...
          </>
        ) : (
          <>
            <Sparkles className="mr-2 h-4 w-4" />방 만들기
          </>
        )}
      </Button>
    </form>
  );
}
