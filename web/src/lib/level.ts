/**
 * The day's final level: thermal result from rules.ts + the patient's own reports + pause modes.
 * The ONLY place that decides the colour shown to the user.
 *
 * Honesty rules (CLAUDE.md):
 * - Thermal levels (green/yellow/orange) come only from rules.ts.
 * - Red comes only from a patient report (wound/blister in the quick check, or a red flag in chat).
 *   The sensors never produce red.
 * - Nothing here can lower a level coming from rules.ts.
 * Decision (see docs/PROGRESS.md): a red report shows red even during a pause mode (safer).
 */
import type { KhEvent } from '@/data/types';
import { DAY_MS, describe, type EvaluatedDay, RIYADH_OFFSET_MS, THRESH } from './rules/rules';
import { ltr } from './format';

export type FinalLevel = 'green' | 'yellow' | 'orange' | 'red' | 'none' | 'paused';
export type PauseMode = 'travel' | 'bandage' | 'hospital';
export type Mode = PauseMode | 'normal';

export interface QuickData {
  skin: 'ok' | 'red' | 'wound';
  pain: 'ok' | 'new';
  care: 'done' | 'skip';
}

export type ReasonCode =
  'thermal' | 'normal' | 'invalid' | 'quick' | 'selfreport' | 'wound' | 'redflag' | 'paused' | 'none';
export interface Reason {
  code: ReasonCode;
  ar: string;
}

export interface DayView {
  key: string;
  idx: number;
  /** Representative time: the scan time, the first report time, or now for an empty today. */
  ts: number;
  thermal: EvaluatedDay | null;
  quick: QuickData | null;
  redflags: string[];
  mode: Mode;
  level: FinalLevel;
  reasons: Reason[];
  /** Counts for adherence: a valid scan or a completed quick check. */
  done: boolean;
}

const SEVERITY: Record<FinalLevel, number> = { paused: -1, none: 0, green: 1, yellow: 2, orange: 3, red: 4 };
export const maxLevel = (a: FinalLevel, b: FinalLevel): FinalLevel => (SEVERITY[b] > SEVERITY[a] ? b : a);
export const severity = (l: FinalLevel) => SEVERITY[l];

export const MODE_AR: Record<Mode, string> = {
  normal: 'عادي',
  travel: 'سفر',
  bandage: 'ضماد',
  hospital: 'تنويم',
};

/** Day key of a timestamp: Riyadh calendar date, same as rules.ts. */
export function realDayKey(ts: number): { key: string; idx: number } {
  const local = new Date(ts + RIYADH_OFFSET_MS);
  return { key: local.toISOString().slice(0, 10), idx: Math.floor((ts + RIYADH_OFFSET_MS) / DAY_MS) };
}

/** Current day key. Demo mode: the latest demo day (so a quick check attaches to the day just measured). */
export function todayKeyOf(now: number, demo: boolean, days: EvaluatedDay[]): { key: string; idx: number } {
  if (!demo) return realDayKey(now);
  const last = days.at(-1);
  return last ? { key: last.key, idx: last.idx } : { key: 'D1', idx: 1 };
}

/** Pause mode in force at time `ts` (latest `mode` event at or before it). */
export function modeAt(events: KhEvent[], ts: number): Mode {
  let m: Mode = 'normal';
  for (const e of events) {
    if (e.kind !== 'mode' || e.ts > ts) continue;
    const v = (e.data as { mode?: string } | undefined)?.mode;
    if (v === 'travel' || v === 'bandage' || v === 'hospital' || v === 'normal') m = v;
  }
  return m;
}

function quickOf(e: KhEvent): QuickData | null {
  const d = e.data as Partial<QuickData> | undefined;
  if (!d || !d.skin) return null;
  return { skin: d.skin, pain: d.pain ?? 'ok', care: d.care ?? 'done' };
}

/** The level and reasons for one day, from its parts. Pure. */
export function levelOf(
  thermal: EvaluatedDay | null,
  quick: QuickData | null,
  redflags: string[],
  mode: Mode,
): { level: FinalLevel; reasons: Reason[] } {
  const reasons: Reason[] = [];
  const red: Reason[] = [];
  if (quick?.skin === 'wound') red.push({ code: 'wound', ar: 'أبلغت عن جرح أو فقاعة أو شق' });
  if (redflags.length) red.push({ code: 'redflag', ar: `ذكرت علامة خطر: ${redflags.join('، ')}` });
  if (red.length) return { level: 'red', reasons: red };

  if (mode === 'bandage' || mode === 'hospital' || (mode === 'travel' && !thermal && !quick)) {
    return {
      level: 'paused',
      reasons: [{ code: 'paused', ar: `وضع ${MODE_AR[mode]}: المقارنة والتنبيهات متوقفة مؤقتًا` }],
    };
  }

  let level: FinalLevel = 'none';
  if (thermal && thermal.status !== 'invalid') {
    level = thermal.level;
    if (thermal.status === 'normal')
      reasons.push({ code: 'normal', ar: `لا فرق أكبر من ${ltr(THRESH + '°')} بين القدمين` });
    else reasons.push({ code: 'thermal', ar: describe(thermal) });
  } else if (thermal) {
    reasons.push({ code: 'invalid', ar: `ما انحسبت قراءة اليوم: ${describe(thermal)}` });
  }
  if (quick) {
    if (level === 'none') level = 'green';
    if (!thermal || thermal.status === 'invalid')
      reasons.push({ code: 'quick', ar: 'سوّيت الفحص السريع بدل القياس' });
    if (quick.skin === 'red' || quick.pain === 'new') {
      level = maxLevel(level, 'yellow');
      reasons.push({
        code: 'selfreport',
        ar: quick.skin === 'red' ? 'أبلغت عن احمرار أو تغيّر لون' : 'أبلغت عن ألم أو خدر جديد',
      });
    }
  }
  if (level === 'none' && !reasons.length) reasons.push({ code: 'none', ar: 'ما وصلنا قياس اليوم' });
  return { level, reasons };
}

/**
 * Merges evaluated thermal days with the patient's events into one view per day,
 * including today even when nothing has been measured yet.
 */
export function buildDayViews(
  days: EvaluatedDay[],
  events: KhEvent[],
  { now, demo }: { now: number; demo: boolean },
): DayView[] {
  const byKey = new Map<
    string,
    {
      key: string;
      idx: number;
      ts: number;
      thermal: EvaluatedDay | null;
      quick: QuickData | null;
      redflags: string[];
    }
  >();
  for (const d of days)
    byKey.set(d.key, {
      key: d.key,
      idx: d.idx,
      ts: Number(d.scan.ts),
      thermal: d,
      quick: null,
      redflags: [],
    });

  const keyIdx = (key: string) =>
    key.startsWith('D') ? Number(key.slice(1)) : Math.floor(Date.parse(key + 'T00:00:00Z') / DAY_MS);
  const keyMatchesMode = (key: string) => (demo ? /^D\d+$/.test(key) : /^\d{4}-\d{2}-\d{2}$/.test(key));

  for (const e of events) {
    if (e.kind !== 'quickcheck' && e.kind !== 'redflag') continue;
    const key = e.day && keyMatchesMode(e.day) ? e.day : demo ? null : realDayKey(e.ts).key;
    if (!key) continue;
    if (!byKey.has(key))
      byKey.set(key, { key, idx: keyIdx(key), ts: e.ts, thermal: null, quick: null, redflags: [] });
    const v = byKey.get(key)!;
    if (e.kind === 'quickcheck')
      v.quick = quickOf(e) ?? v.quick; // latest quick check of the day wins
    else v.redflags.push(String((e.data as { why?: unknown } | undefined)?.why ?? 'علامة خطر'));
  }

  const today = todayKeyOf(now, demo, days);
  if (!byKey.has(today.key))
    byKey.set(today.key, {
      key: today.key,
      idx: today.idx,
      ts: now,
      thermal: null,
      quick: null,
      redflags: [],
    });

  return [...byKey.values()]
    .sort((a, b) => a.idx - b.idx)
    .map((v) => {
      const isToday = v.key === today.key;
      const mode = modeAt(events, isToday ? now : v.ts);
      const { level, reasons } = levelOf(v.thermal, v.quick, v.redflags, mode);
      const done = !!(v.thermal && v.thermal.valid) || !!v.quick;
      return { ...v, mode, level, reasons, done };
    });
}

/** "What to do now", in plain Saudi Arabic. Never a diagnosis or a medicine. */
export function nextSteps(level: FinalLevel, opts: { mode?: Mode; familyInformed?: boolean } = {}): string {
  switch (level) {
    case 'green':
      return 'استمر على روتينك: افحص قدميك كل يوم، وقِس بكرة قبل الوضوء.';
    case 'yellow':
      return 'ارتح بقدميك وخفّف المشي الطويل، وأعد القياس بكرة بنفس الطريقة. إذا لاحظت جرح أو ألم جديد اكتب للمساعد.';
    case 'orange':
      return `خفّف المشي على المكان، وصوّره من شاشة «التصوير» عشان تشوفه العيادة. لا تدلّك المنطقة ولا تحط عليها شي بدون توجيه الممرضة.${opts.familyInformed ? ' وأبلغنا عائلتك.' : ''}`;
    case 'red':
      return 'تواصل مع العيادة أو احجز موعد اليوم، ولا تنتظر. إذا عندك حمى أو ألم شديد أو سائل من جرح، روح لأقرب طوارئ.';
    case 'paused':
      return opts.mode === 'hospital'
        ? 'سلامتك. التذكيرات والتنبيهات متوقفة طول فترة التنويم.'
        : opts.mode === 'bandage'
          ? 'المقارنة بين القدمين متوقفة لأن الضماد يغيّر الحرارة. افحص قدمك بالنظر كل يوم.'
          : 'السجادة ما تنتظرك. سوّ الفحص السريع كل يوم لين ترجع.';
    default:
      return 'قف على السجادة قبل الوضوء، أو سوّ الفحص السريع إذا ما قدرت اليوم.';
  }
}

/** The site to look at (for the photo screen and the result map): first alert site, else first flagged. */
export function focusSite(view: DayView | null | undefined): { foot: 'L' | 'R'; i: number } | null {
  const t = view?.thermal;
  if (!t || t.status === 'invalid') return null;
  const i = t.alertSites[0] ?? t.check.flagged[0];
  if (i === undefined) return null;
  const d = t.check.diff[i];
  if (d === null || d === undefined) return null;
  return { foot: d > 0 ? 'R' : 'L', i };
}
