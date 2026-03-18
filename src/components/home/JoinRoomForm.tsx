'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, LogIn } from 'lucide-react';

interface JoinRoomFormProps {
  onSubmit: (data: { roomCode: string; nickname: string }) => void;
  isLoading?: boolean;
  /** URL에서 미리 채워진 방 코드 */
  initialRoomCode?: string;
}

export default function JoinRoomForm({
  onSubmit,
  isLoading = false,
  initialRoomCode = '',
}: JoinRoomFormProps) {
  const [roomCode, setRoomCode] = useState(initialRoomCode.toUpperCase());
  const [nickname, setNickname] = useState('');

  const handleRoomCodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 알파벳과 숫자만 허용, 대문자 변환
    const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setRoomCode(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!roomCode.trim() || !nickname.trim()) return;
    onSubmit({ roomCode: roomCode.trim(), nickname: nickname.trim() });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <Label htmlFor="roomCode">방 코드</Label>
        <Input
          id="roomCode"
          value={roomCode}
          onChange={handleRoomCodeChange}
          placeholder="ABC123"
          maxLength={6}
          required
          disabled={isLoading}
          autoComplete="off"
          className="font-mono text-center text-xl tracking-[0.4em] h-12 uppercase"
        />
        <p className="text-xs text-muted-foreground text-center">
          6자리 코드를 입력하세요
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="join-nickname">닉네임</Label>
        <Input
          id="join-nickname"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          placeholder="플레이어 이름"
          maxLength={12}
          required
          disabled={isLoading}
          autoComplete="off"
        />
      </div>

      <Button
        type="submit"
        className="w-full h-12 text-base font-bold tracking-wide"
        disabled={isLoading || roomCode.length < 6 || !nickname.trim()}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            입장 중...
          </>
        ) : (
          <>
            <LogIn className="mr-2 h-4 w-4" />
            방 입장하기
          </>
        )}
      </Button>
    </form>
  );
}
