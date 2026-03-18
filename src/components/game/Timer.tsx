'use client';

import { cn } from '@/lib/utils';
import { useTimer } from '@/hooks/useTimer';

interface TimerProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

const SIZE_MAP = {
  sm: { outer: 48, stroke: 3, textClass: 'text-xs' },
  md: { outer: 64, stroke: 4, textClass: 'text-sm' },
  lg: { outer: 88, stroke: 5, textClass: 'text-lg' },
};

export default function Timer({ className, size = 'md' }: TimerProps) {
  const { remaining, progress, isUrgent } = useTimer();
  const { outer, stroke, textClass } = SIZE_MAP[size];
  const radius = (outer - stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className={cn('relative inline-flex items-center justify-center', className)}>
      <svg width={outer} height={outer} className="-rotate-90" aria-hidden>
        <circle
          cx={outer / 2}
          cy={outer / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          className="text-muted/20"
        />
        <circle
          cx={outer / 2}
          cy={outer / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className={cn(
            'transition-[stroke-dashoffset] duration-200',
            isUrgent ? 'text-red-400' : 'text-primary',
          )}
        />
      </svg>
      <span
        className={cn(
          'absolute font-bold tabular-nums',
          textClass,
          isUrgent ? 'text-red-400' : 'text-foreground',
        )}
      >
        {remaining}
      </span>
    </div>
  );
}
