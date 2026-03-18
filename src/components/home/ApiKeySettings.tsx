'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useSettingsStore } from '@/store/settings-store';
import { toast } from '@/hooks/use-toast';
import { Settings, Eye, EyeOff, Trash2, Sparkles, Zap } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

export default function ApiKeySettings() {
  const { apiKey, setApiKey, clearApiKey } = useSettingsStore();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [showKey, setShowKey] = useState(false);

  const hasKey = apiKey.length > 0;

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setDraft(apiKey);
      setShowKey(false);
    }
  };

  const handleSave = () => {
    const trimmed = draft.trim();
    if (trimmed && !trimmed.startsWith('sk-ant-')) {
      toast({
        variant: 'destructive',
        title: '잘못된 API 키',
        description: 'Anthropic API 키는 sk-ant-로 시작해야 합니다.',
      });
      return;
    }
    setApiKey(trimmed);
    setOpen(false);
    toast({
      variant: trimmed ? 'success' : 'default',
      title: trimmed ? 'Claude AI 활성화' : 'API 키 제거됨',
      description: trimmed
        ? 'Claude AI가 플레이어로 참여합니다.'
        : '로컬 AI 모드로 전환되었습니다.',
    });
  };

  const handleClear = () => {
    setDraft('');
    clearApiKey();
    setOpen(false);
    toast({ title: 'API 키 제거됨', description: '로컬 AI 모드로 전환되었습니다.' });
  };

  const maskedKey = apiKey
    ? `${apiKey.slice(0, 10)}${'•'.repeat(Math.min(20, apiKey.length - 14))}${apiKey.slice(-4)}`
    : '';

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        <button className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors group">
          {hasKey ? (
            <>
              <Badge variant="ai" className="text-xs gap-1">
                <Sparkles className="h-3 w-3" />
                Claude AI
              </Badge>
            </>
          ) : (
            <>
              <Zap className="h-3.5 w-3.5" />
              <span>로컬 AI 모드</span>
              <Settings className="h-3.5 w-3.5 group-hover:rotate-45 transition-transform duration-300" />
            </>
          )}
        </button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Claude AI 설정
          </DialogTitle>
          <DialogDescription>
            API 키를 입력하면 Claude AI가 더 자연스럽게 플레이합니다.
            <br />
            키가 없어도 로컬 AI로 게임을 즐길 수 있습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* 현재 상태 표시 */}
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            {hasKey ? (
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-emerald-400 font-medium flex items-center gap-1.5">
                    <Sparkles className="h-3.5 w-3.5" />
                    Claude AI 활성화됨
                  </p>
                  <p className="text-muted-foreground font-mono text-xs mt-0.5">{maskedKey}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleClear}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 gap-1.5"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  제거
                </Button>
              </div>
            ) : (
              <p className="text-muted-foreground flex items-center gap-1.5">
                <Zap className="h-3.5 w-3.5" />
                현재 로컬 AI 모드로 동작 중
              </p>
            )}
          </div>

          {/* API 키 입력 */}
          <div className="space-y-2">
            <Label htmlFor="api-key">Anthropic API 키</Label>
            <div className="relative">
              <Input
                id="api-key"
                type={showKey ? 'text' : 'password'}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                placeholder="sk-ant-api03-..."
                className="pr-10 font-mono text-sm"
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              키는 브라우저 localStorage에만 저장되며 서버로 전송되지 않습니다.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setOpen(false)}>
            취소
          </Button>
          <Button onClick={handleSave} disabled={draft === apiKey}>
            저장
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
