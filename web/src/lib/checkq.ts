/** The 3-tap quick check (from the prototype's CHECK_Q). Used instead of a scan when the mat is unavailable. */
import type { QuickData } from './level';

export interface CheckQuestion<K extends keyof QuickData = keyof QuickData> {
  key: K;
  q: string;
  options: { value: QuickData[K]; label: string; tone?: 'ok' | 'warn' | 'bad' }[];
}

export const CHECK_Q: CheckQuestion[] = [
  {
    key: 'skin',
    q: 'شوف قدميك من فوق وتحت وبين الأصابع. وش تشوف؟',
    options: [
      { value: 'ok', label: 'عادي', tone: 'ok' },
      { value: 'red', label: 'احمرار أو تغيّر لون', tone: 'warn' },
      { value: 'wound', label: 'جرح أو فقاعة أو شق', tone: 'bad' },
    ],
  },
  {
    key: 'pain',
    q: 'الإحساس: فيه ألم أو خدر جديد؟',
    options: [
      { value: 'ok', label: 'لا', tone: 'ok' },
      { value: 'new', label: 'نعم، جديد', tone: 'warn' },
    ],
  },
  {
    key: 'care',
    q: 'العناية اليوم: نشّفت بين الأصابع ولبست حذاء مناسب؟',
    options: [
      { value: 'done', label: 'نعم', tone: 'ok' },
      { value: 'skip', label: 'ما قدرت', tone: 'warn' },
    ],
  },
] as CheckQuestion[];
