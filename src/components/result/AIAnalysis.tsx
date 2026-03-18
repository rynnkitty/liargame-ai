'use client';

import { useState } from 'react';
import { useRoom } from '@/hooks/useRoom';
import { useSettingsStore } from '@/store/settings-store';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';

interface AnalysisResult {
  summary: string;
  mvp?: string;
  suspectMoments?: string[];
  tips?: string[];
}

export default function AIAnalysis() {
  const { room } = useRoom();
  const { apiKey } = useSettingsStore();
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  if (!apiKey) {
    return (
      <div className="rounded-xl border border-border/50 bg-card/30 p-4 text-center">
        <p className="text-xs text-muted-foreground">
          🔑 Claude API 키를 설정하면 AI 게임 분석 리포트를 받을 수 있습니다
        </p>
      </div>
    );
  }

  const fetchAnalysis = async () => {
    if (!room || isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room.id, apiKey }),
      });
      if (!res.ok) throw new Error('분석 요청 실패');
      const data = await res.json();
      setAnalysis(data);
      setIsExpanded(true);
    } catch {
      setError('AI 분석을 가져오지 못했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleHeaderClick = () => {
    if (analysis) {
      setIsExpanded(!isExpanded);
    } else {
      fetchAnalysis();
    }
  };

  return (
    <div className="rounded-xl border border-primary/20 bg-card/50 overflow-hidden animate-slide-in-up">
      {/* 헤더 */}
      <button
        onClick={handleHeaderClick}
        disabled={isLoading}
        className="w-full flex items-center justify-between p-4 hover:bg-primary/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="font-semibold text-sm">AI 게임 분석</span>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && <Loader2 className="w-4 h-4 animate-spin text-primary" />}
          {analysis &&
            (isExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ))}
          {!analysis && !isLoading && (
            <span className="text-xs text-primary font-medium">분석하기 →</span>
          )}
        </div>
      </button>

      {/* 분석 결과 */}
      {isExpanded && analysis && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/50">
          {analysis.summary && (
            <div className="pt-3">
              <p className="text-xs font-semibold text-muted-foreground mb-1">게임 요약</p>
              <p className="text-sm leading-relaxed">{analysis.summary}</p>
            </div>
          )}

          {analysis.mvp && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">🏆 MVP</p>
              <p className="text-sm font-medium text-amber-400">{analysis.mvp}</p>
            </div>
          )}

          {analysis.suspectMoments && analysis.suspectMoments.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">
                🔍 의심스러운 순간
              </p>
              <ul className="space-y-1.5">
                {analysis.suspectMoments.map((m, i) => (
                  <li key={i} className="text-sm text-foreground/80 flex gap-2">
                    <span className="text-muted-foreground shrink-0 mt-0.5">•</span>
                    {m}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {analysis.tips && analysis.tips.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1.5">💡 다음 게임 팁</p>
              <ul className="space-y-1.5">
                {analysis.tips.map((t, i) => (
                  <li key={i} className="text-sm text-foreground/80 flex gap-2">
                    <span className="text-primary shrink-0 mt-0.5">→</span>
                    {t}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="px-4 pb-4 border-t border-border/50 pt-3">
          <p className="text-xs text-destructive">{error}</p>
          <Button variant="ghost" size="sm" onClick={fetchAnalysis} className="text-xs mt-1 h-7">
            다시 시도
          </Button>
        </div>
      )}
    </div>
  );
}
