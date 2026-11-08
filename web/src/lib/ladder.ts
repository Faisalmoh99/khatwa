/**
 * Adherence ladder (real calendar, Riyadh time):
 *   step 1 measuring normally · step 2 one day missed → reminder + quick check offer
 *   step 3 two days missed → family · step 4 three days → clinic (repeats every 3 days)
 * Days in a pause mode (travel without measurement, bandage, hospital) are not counted as missed.
 * Today counts as missed only after the daily reminder time has passed.
 */
import type { KhEvent } from '@/data/types';
import { type DayView, type Mode, modeAt, realDayKey } from './level';
import { DAY_MS, RIYADH_OFFSET_MS } from './rules/rules';

export const LADDER_STEPS = ['قياس', 'فحص سريع', 'العائلة', 'العيادة'] as const;

export interface LadderState {
  step: 1 | 2 | 3 | 4;
  missed: number;
  paused: boolean;
  mode: Mode;
  /** No measurement ever: the patient has not started yet. */
  fresh: boolean;
  todayDone: boolean;
}

/** Minutes since midnight, Riyadh time. */
export function riyadhMinutes(ts: number): number {
  const d = new Date(ts + RIYADH_OFFSET_MS);
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

export function parseHHMM(s: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 20 * 60;
}

export function ladderState(
  views: DayView[],
  events: KhEvent[],
  now: number,
  reminderTime = '20:00',
): LadderState {
  const today = realDayKey(now);
  const mode = modeAt(events, now);
  const doneIdx = views.filter((v) => v.done && v.idx <= today.idx).map((v) => v.idx);
  const todayDone = doneIdx.includes(today.idx);
  const paused = mode !== 'normal';
  if (!doneIdx.length) return { step: 1, missed: 0, paused, mode, fresh: true, todayDone: false };
  const lastDone = Math.max(...doneIdx);

  let missed = 0;
  for (let idx = lastDone + 1; idx < today.idx; idx++) {
    const noon = idx * DAY_MS - RIYADH_OFFSET_MS + 12 * 3_600_000;
    if (modeAt(events, noon) === 'normal') missed++;
  }
  if (!todayDone && !paused && riyadhMinutes(now) >= parseHHMM(reminderTime)) missed++;
  if (paused) return { step: 1, missed, paused, mode, fresh: false, todayDone };
  const step = missed >= 3 ? 4 : missed === 2 ? 3 : missed === 1 ? 2 : 1;
  return { step, missed, paused, mode, fresh: false, todayDone };
}

/** Plain-language description of the ladder state for the patient. */
export function ladderText(s: LadderState): string {
  if (s.paused) return 'السلّم متوقف مؤقتًا بسبب الوضع الخاص.';
  if (s.fresh) return 'ابدأ أول قياس على السجادة.';
  if (s.step === 1) return s.todayDone ? 'قست اليوم. ممتاز.' : 'ما فاتك شي. قِس اليوم قبل الوضوء.';
  if (s.step === 2) return 'فاتك يوم بدون قياس. قِس اليوم، أو سوّ الفحص السريع.';
  if (s.step === 3) return 'يومين بدون قياس. أرسلنا تذكير لعائلتك (إذا وافقت).';
  return `${s.missed >= 11 ? `${s.missed} يومًا` : `${s.missed} أيام`} بدون قياس. أبلغنا العيادة عشان تطمّن عليك.`;
}
