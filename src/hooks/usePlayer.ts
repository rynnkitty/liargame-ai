'use client';

const PLAYER_NAME_KEY = 'lgai_player_name';
const PLAYER_ID_KEY = 'lgai_player_id';

export function usePlayer() {
  const getPlayerName = (): string | null => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(PLAYER_NAME_KEY);
  };

  const getPlayerId = (): string | null => {
    if (typeof window === 'undefined') return null;
    return sessionStorage.getItem(PLAYER_ID_KEY);
  };

  const saveSession = (name: string, id: string) => {
    sessionStorage.setItem(PLAYER_NAME_KEY, name);
    sessionStorage.setItem(PLAYER_ID_KEY, id);
  };

  const savePlayerName = (name: string) => {
    sessionStorage.setItem(PLAYER_NAME_KEY, name);
  };

  const clearSession = () => {
    sessionStorage.removeItem(PLAYER_NAME_KEY);
    sessionStorage.removeItem(PLAYER_ID_KEY);
  };

  return { getPlayerName, getPlayerId, saveSession, savePlayerName, clearSession };
}
