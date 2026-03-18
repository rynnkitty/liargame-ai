'use client';

import { useState, useEffect } from 'react';
import { useGameStore } from '@/store/game-store';

export function useTimer() {
  const { phaseStartAt, phaseDurationSec } = useGameStore();
  const [remaining, setRemaining] = useState(0);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    if (!phaseStartAt || phaseDurationSec <= 0) {
      setRemaining(0);
      setTotal(0);
      return;
    }

    setTotal(phaseDurationSec);

    const update = () => {
      const elapsed = (Date.now() - phaseStartAt) / 1000;
      const rem = Math.max(0, phaseDurationSec - elapsed);
      setRemaining(Math.ceil(rem));
    };

    update();
    const interval = setInterval(update, 200);
    return () => clearInterval(interval);
  }, [phaseStartAt, phaseDurationSec]);

  const progress = total > 0 ? remaining / total : 0;
  const isUrgent = remaining <= 10 && remaining > 0;

  return { remaining, total, progress, isUrgent };
}
