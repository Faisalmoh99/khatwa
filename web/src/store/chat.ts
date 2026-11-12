/** Chat history per day (local to this phone). The clinic sees what matters through events. */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { ChatMsg } from '@/lib/agent/templates';

interface ChatDay {
  msgs: ChatMsg[];
  /** The patient has interacted: the opener is no longer replaced when the state changes. */
  touched: boolean;
  /** State the opener was written for. */
  stateKey: string;
}

interface ChatState {
  days: Record<string, ChatDay>;
  setDay: (day: string, d: ChatDay) => void;
}

export const useChat = create<ChatState>()(
  persist(
    (set) => ({
      days: {},
      setDay: (day, d) =>
        set((s) => {
          const days = { ...s.days, [day]: d };
          const keep = Object.keys(days).sort().slice(-7);
          return { days: Object.fromEntries(keep.map((k) => [k, days[k]!])) };
        }),
    }),
    {
      name: 'kh.chat',
      storage: createJSONStorage(() => {
        try {
          return localStorage;
        } catch {
          const m = new Map<string, string>();
          return {
            getItem: (k) => m.get(k) ?? null,
            setItem: (k, v) => void m.set(k, v),
            removeItem: (k) => void m.delete(k),
          };
        }
      }),
    },
  ),
);
