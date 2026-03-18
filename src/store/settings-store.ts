import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface SettingsStore {
  // Claude API 키 (선택 사항 — 없으면 로컬 AI 동작)
  apiKey: string;
  setApiKey: (key: string) => void;
  clearApiKey: () => void;
}

// localStorage에 API 키를 안전하게 저장
// Next.js SSR 환경에서 window가 없을 수 있으므로 noSSR storage 사용
const noSSRStorage = {
  getItem: (name: string) => {
    if (typeof window === 'undefined') return null;
    return window.localStorage.getItem(name);
  },
  setItem: (name: string, value: string) => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(name, value);
  },
  removeItem: (name: string) => {
    if (typeof window === 'undefined') return;
    window.localStorage.removeItem(name);
  },
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set) => ({
      apiKey: '',
      setApiKey: (apiKey) => set({ apiKey }),
      clearApiKey: () => set({ apiKey: '' }),
    }),
    {
      name: 'liargame-settings',
      storage: createJSONStorage(() => noSSRStorage),
      // API 키만 지속 저장
      partialize: (state) => ({ apiKey: state.apiKey }),
    },
  ),
);
