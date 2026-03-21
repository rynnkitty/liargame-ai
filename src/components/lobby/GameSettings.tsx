'use client';

import { useState, useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { GameSettings as GameSettingsType } from '@/types/game';
import { CATEGORIES, AI_SUGGEST_CATEGORY } from '@/constants/categories';
import { Settings, Timer, Tag, Gamepad2, ChevronDown, ChevronUp, Wand2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSettingsStore } from '@/store/settings-store';

interface GameSettingsProps {
  settings: GameSettingsType;
  onUpdate: (settings: Partial<GameSettingsType>) => void;
  isHost: boolean;
}

const TIMER_OPTIONS = [
  { value: '30', label: '30초' },
  { value: '60', label: '1분' },
  { value: '90', label: '1분 30초' },
  { value: '120', label: '2분' },
  { value: '180', label: '3분' },
];

const DESCRIPTION_TIMER_OPTIONS = [
  { value: '30', label: '30초' },
  { value: '45', label: '45초' },
  { value: '60', label: '1분' },
  { value: '90', label: '1분 30초' },
];

export default function GameSettings({ settings, onUpdate, isHost }: GameSettingsProps) {
  const [expanded, setExpanded] = useState(false);
  const apiKey = useSettingsStore((s) => s.apiKey);
  const hasApiKey = !!apiKey || process.env.NEXT_PUBLIC_HAS_CLAUDE === 'true';

  const allCategories = hasApiKey && settings.useAIKeywords
    ? [AI_SUGGEST_CATEGORY, ...CATEGORIES]
    : CATEGORIES;
  const currentCategory =
    settings.category === AI_SUGGEST_CATEGORY.id
      ? AI_SUGGEST_CATEGORY
      : CATEGORIES.find((c) => c.id === settings.category);

  // AI 활성화 상태일 때 카테고리 기본값을 AI 추천으로 설정
  useEffect(() => {
    if (!isHost) return;
    if (hasApiKey && settings.useAIKeywords && !settings.category) {
      onUpdate({ category: AI_SUGGEST_CATEGORY.id });
    }
  }, [hasApiKey, settings.useAIKeywords, settings.category, isHost]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCategoryChange = (value: string) => {
    onUpdate({ category: value });
  };

  const handleAIKeywordsChange = (checked: boolean) => {
    if (!isHost) return;
    if (!checked && settings.category === AI_SUGGEST_CATEGORY.id) {
      // AI 키워드 끌 때 ai_suggest 카테고리도 초기화
      onUpdate({ useAIKeywords: checked, category: '' });
    } else if (checked && hasApiKey) {
      // AI 키워드 켤 때 카테고리를 AI 추천으로 설정
      onUpdate({ useAIKeywords: checked, category: AI_SUGGEST_CATEGORY.id });
    } else {
      onUpdate({ useAIKeywords: checked });
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card/50 overflow-hidden">
      {/* 헤더 */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Settings className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">게임 설정</span>
        </div>
        <div className="flex items-center gap-2">
          {/* 요약 뱃지 */}
          <div className="flex items-center gap-1.5 mr-1">
            <Badge variant="outline" className="text-xs gap-1 hidden sm:flex">
              {settings.mode === 'liar' ? <><img src="/kitty-logo.png" className="inline w-4 h-4 object-contain" alt="" /> 라이어</> : '🃏 바보'}
            </Badge>
            <Badge variant="outline" className="text-xs gap-1 hidden sm:flex">
              {currentCategory?.emoji} {currentCategory?.label}
            </Badge>
          </div>
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          )}
        </div>
      </button>

      {/* 설정 패널 */}
      {expanded && (
        <div className="border-t border-border p-4 space-y-5 animate-slide-in-up">
          {/* 게임 모드 */}
          <div className="space-y-3">
            <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wide">
              <Gamepad2 className="h-3.5 w-3.5" />
              게임 모드
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                {
                  value: 'liar',
                  emoji: <img src="/kitty-logo.png" className="w-6 h-6 object-contain" alt="라이어" />,
                  label: '라이어',
                  desc: '라이어를 찾아라',
                },
                {
                  value: 'fool',
                  emoji: '🃏',
                  label: '바보',
                  desc: '바보를 피해라',
                },
              ].map((mode) => (
                <button
                  key={mode.value}
                  onClick={() => isHost && onUpdate({ mode: mode.value as 'liar' | 'fool' })}
                  disabled={!isHost}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-lg border p-3 text-center transition-all duration-150',
                    settings.mode === mode.value
                      ? 'border-primary/50 bg-primary/10 text-foreground'
                      : 'border-border text-muted-foreground hover:border-muted-foreground/40',
                    !isHost && 'cursor-default',
                  )}
                >
                  <span className="flex items-center justify-center h-6">{mode.emoji}</span>
                  <span className="text-sm font-semibold">{mode.label}</span>
                  <span className="text-[10px]">{mode.desc}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 카테고리 */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wide">
              <Tag className="h-3.5 w-3.5" />
              카테고리
            </Label>
            <Select
              value={settings.category}
              onValueChange={handleCategoryChange}
              disabled={!isHost}
            >
              <SelectTrigger>
                <SelectValue>
                  <span>
                    {currentCategory?.emoji} {currentCategory?.label}
                  </span>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {allCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <span className="flex items-center gap-2">
                      <span>{cat.emoji}</span>
                      <span>{cat.label}</span>
                      {cat.id === AI_SUGGEST_CATEGORY.id && (
                        <span className="text-[10px] text-muted-foreground">(게임 시작 시 결정)</span>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* AI 키워드 */}
          <div className="space-y-2">
            <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wide">
              <Wand2 className="h-3.5 w-3.5" />
              AI 키워드
            </Label>
            <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <div className="space-y-0.5">
                <p className="text-sm font-medium">AI가 키워드 생성</p>
                <p className="text-xs text-muted-foreground">
                  {hasApiKey
                    ? '매 판 AI가 새 키워드를 제안합니다'
                    : 'API 키를 등록하면 활성화됩니다'}
                </p>
              </div>
              <Switch
                checked={settings.useAIKeywords && hasApiKey}
                onCheckedChange={handleAIKeywordsChange}
                disabled={!isHost || !hasApiKey}
              />
            </div>
          </div>

          {/* 타이머 설정 */}
          <div className="space-y-3">
            <Label className="flex items-center gap-1.5 text-xs uppercase tracking-wide">
              <Timer className="h-3.5 w-3.5" />
              타이머
            </Label>

            <div className="grid grid-cols-1 gap-2.5">
              {/* 설명 타이머 */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground min-w-[80px]">설명 시간</span>
                <Select
                  value={String(settings.descriptionTimerSec)}
                  onValueChange={(v) => isHost && onUpdate({ descriptionTimerSec: Number(v) })}
                  disabled={!isHost}
                >
                  <SelectTrigger className="w-[120px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DESCRIPTION_TIMER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 토론 타이머 */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground min-w-[80px]">토론 시간</span>
                <Select
                  value={String(settings.discussionTimerSec)}
                  onValueChange={(v) => isHost && onUpdate({ discussionTimerSec: Number(v) })}
                  disabled={!isHost}
                >
                  <SelectTrigger className="w-[120px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 투표 타이머 */}
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground min-w-[80px]">투표 시간</span>
                <Select
                  value={String(settings.voteTimerSec)}
                  onValueChange={(v) => isHost && onUpdate({ voteTimerSec: Number(v) })}
                  disabled={!isHost}
                >
                  <SelectTrigger className="w-[120px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DESCRIPTION_TIMER_OPTIONS.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value} className="text-xs">
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {!isHost && (
            <p className="text-xs text-muted-foreground text-center">방장만 설정을 변경할 수 있습니다</p>
          )}
        </div>
      )}
    </div>
  );
}
