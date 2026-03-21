'use client';

import { useState } from 'react';
import { useRoom } from '@/hooks/useRoom';
import { useSettingsStore } from '@/store/settings-store';
import { Button } from '@/components/ui/button';
import { Loader2, Sparkles, ChevronDown, ChevronUp, Trophy, Search, Lightbulb, FileText } from 'lucide-react';

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

  if (!apiKey && process.env.NEXT_PUBLIC_HAS_CLAUDE !== 'true') {
    return (
      <div className="rounded-xl border border-border/50 bg-card/30 p-4 text-center">
        <p className="text-xs text-muted-foreground">
          🔑 Claude API 키를 설정하면 AI 게임 분석 리포트를 받을 수 있습니다
        </p>
      </div>
    );
  }

  const fetchAnalysis = async () => {
    if (!room || !room.gameResult || isLoading) return;
    setIsLoading(true);
    setError(null);
    try {
      const playerNames = Object.fromEntries(room.players.map((p) => [p.id, p.name]));
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (apiKey) headers['x-api-key'] = apiKey;
      const res = await fetch('/api/ai/analyze', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          result: room.gameResult,
          descriptions: room.descriptions,
          messages: room.messages,
          playerNames,
        }),
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
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-primary/5 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <span className="font-bold text-base">AI 게임 분석</span>
        </div>
        <div className="flex items-center gap-2">
          {isLoading && (
            <span className="flex items-center gap-1.5 text-xs text-primary">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              분석 중...
            </span>
          )}
          {analysis &&
            (isExpanded ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ))}
          {!analysis && !isLoading && (
            <span className="text-xs text-primary font-semibold bg-primary/10 px-2.5 py-1 rounded-full">
              분석하기 →
            </span>
          )}
        </div>
      </button>

      {/* 분석 결과 */}
      {isExpanded && analysis && (
        <div className="border-t border-border/50 divide-y divide-border/40">

          {/* 게임 요약 */}
          {analysis.summary && (
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-2.5">
                <FileText className="w-4 h-4 text-sky-400 shrink-0" />
                <span className="text-sm font-bold text-sky-400">게임 요약</span>
              </div>
              <div className="text-sm leading-relaxed text-foreground/90 pl-6 space-y-1.5">
                {analysis.summary.split('\n').map((line, i) =>
                  line.trim() ? (
                    <p key={i}>{line}</p>
                  ) : (
                    <div key={i} className="h-1" />
                  ),
                )}
              </div>
            </div>
          )}

          {/* MVP */}
          {analysis.mvp && (
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-2.5">
                <Trophy className="w-4 h-4 text-amber-400 shrink-0" />
                <span className="text-sm font-bold text-amber-400">이번 게임 MVP</span>
              </div>
              <div className="pl-6">
                <span className="inline-block text-base font-bold text-amber-300 bg-amber-400/10 border border-amber-400/20 px-3 py-1 rounded-lg">
                  {analysis.mvp}
                </span>
              </div>
            </div>
          )}

          {/* 의심스러운 순간 */}
          {analysis.suspectMoments && analysis.suspectMoments.length > 0 && (
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <Search className="w-4 h-4 text-rose-400 shrink-0" />
                <span className="text-sm font-bold text-rose-400">의심스러운 순간</span>
              </div>
              <ul className="space-y-2.5 pl-1">
                {analysis.suspectMoments.map((m, i) => (
                  <li key={i} className="flex gap-3 text-sm text-foreground/85">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-rose-500/15 border border-rose-500/25 text-rose-400 text-[11px] font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{m}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 다음 게임 팁 */}
          {analysis.tips && analysis.tips.length > 0 && (
            <div className="px-5 py-4">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="text-sm font-bold text-emerald-400">다음 게임 팁</span>
              </div>
              <ul className="space-y-2.5 pl-1">
                {analysis.tips.map((t, i) => (
                  <li key={i} className="flex gap-3 text-sm text-foreground/85">
                    <span className="shrink-0 w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 text-[11px] font-bold flex items-center justify-center mt-0.5">
                      {i + 1}
                    </span>
                    <span className="leading-relaxed">{t}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

        </div>
      )}

      {/* 에러 */}
      {error && (
        <div className="px-5 py-4 border-t border-border/50 flex items-center justify-between">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="ghost" size="sm" onClick={fetchAnalysis} className="text-xs h-7 shrink-0">
            다시 시도
          </Button>
        </div>
      )}
    </div>
  );
}
