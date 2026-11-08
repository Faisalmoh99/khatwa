/**
 * Khatwa rule engine (4 sites per foot). TypeScript port of app/js/rules.js.
 *
 * THE ONLY place where a thermal level is decided. Pure: no Firebase, no DOM.
 * Rule (IWGDF): a difference greater than 2.2°C at the same site between the two feet,
 * on two consecutive days, with the same foot being the warmer one.
 *
 * Behaviour must stay identical to app/js/rules.js (the simulator and dev page still use it).
 * rules.test.ts runs a parity check against that file.
 */

import { consecutiveDays, ltr } from '../format';

export const THRESH = 2.2; // strictly greater than, not equal

/** Fixed site order. Same order as the sensors in the device and the simulator. */
export const SITES = [
  { id: 'hallux', ar: 'الإبهام' },
  { id: 'mth1', ar: 'رأس المشط الأول' },
  { id: 'mth5', ar: 'رأس المشط الخامس' },
  { id: 'heel', ar: 'الكعب' },
] as const;
export const N = SITES.length;
export type SiteIndex = 0 | 1 | 2 | 3;

/** Outside this range = implausible temperature (wet foot, hot floor, error). */
export const PLAUSIBLE = { min: 20, max: 40 } as const;
export const DAY_MS = 86_400_000;
export const RIYADH_OFFSET_MS = 3 * 3_600_000;

/**
 * Two rule behaviours waiting for the clinical reviewer (Nouran). See docs/REVIEW.md R2 and R5.
 * The defaults reproduce app/js/rules.js exactly. Do NOT change them without her answer.
 * When she answers, add the new branch here and flip the test.todo cases in rules.test.ts.
 */
export interface RulePolicy {
  /** R2: every usable site above threshold in the same direction. 'reject' = treat as a posture error. */
  allSitesHot: 'reject';
  /** R5: which scan represents a day when there are several. 'lastValid' = the latest valid scan. */
  dayPick: 'lastValid';
}
export const POLICY: Readonly<RulePolicy> = Object.freeze({ allSitesHot: 'reject', dayPick: 'lastValid' });

const round2 = (v: number) => Math.round(v * 100) / 100;

/** A scan as stored in Firebase (see docs/DATA_SCHEMA.md). Arrays may come back as objects. */
export interface ScanInput {
  id?: string;
  ts: number | string;
  L: unknown;
  R: unknown;
  standingOk?: boolean;
  stable?: boolean;
  demoDay?: number;
  [k: string]: unknown;
}

export type IssueCode = 'shape' | 'standing' | 'unstable' | 'implausible' | 'fault' | 'allsites';
export interface Issue {
  code: IssueCode;
  ar: string;
  faults?: string[];
}

export interface ScanCheck {
  ok: boolean;
  diff: (number | null)[];
  usable: boolean[];
  faults: string[];
  flagged: number[];
  maxSite: number;
  issues: Issue[];
}

/** Firebase RTDB sometimes returns an array as an object {0:..,1:..}. */
export function toArr(a: unknown): unknown[] {
  if (Array.isArray(a)) return a;
  if (a && typeof a === 'object')
    return Object.keys(a)
      .sort((x, y) => Number(x) - Number(y))
      .map((k) => (a as Record<string, unknown>)[k]);
  return [];
}

/** Sensor fault: DS18B20 returns -127 when disconnected, and 85 when power drops during a read. */
export function isSensorFault(v: unknown): boolean {
  return typeof v !== 'number' || !Number.isFinite(v) || v <= -100 || v === 85;
}

/** Checks one scan and returns the per-site difference and the problems. ok=false means re-stand. */
export function checkScan(scan: Partial<ScanInput> | null | undefined): ScanCheck {
  const L = toArr(scan?.L);
  const R = toArr(scan?.R);
  const issues: Issue[] = [];
  if (L.length !== N || R.length !== N) {
    return {
      ok: false,
      diff: [],
      usable: [],
      faults: [],
      flagged: [],
      maxSite: -1,
      issues: [{ code: 'shape', ar: 'شكل القراءة غير صحيح' }],
    };
  }
  const faults: string[] = [];
  const implausible: number[] = [];
  const diff: (number | null)[] = [];
  const usable: boolean[] = [];
  for (let i = 0; i < N; i++) {
    const lf = isSensorFault(L[i]);
    const rf = isSensorFault(R[i]);
    if (lf) faults.push('L' + i);
    if (rf) faults.push('R' + i);
    const l = L[i] as number;
    const r = R[i] as number;
    const bad = !lf && !rf && [l, r].some((v) => v < PLAUSIBLE.min || v > PLAUSIBLE.max);
    if (bad) implausible.push(i);
    usable[i] = !lf && !rf && !bad;
    diff[i] = usable[i] ? round2(r - l) : null; // positive = right is warmer
  }
  if (scan?.standingOk === false)
    issues.push({ code: 'standing', ar: 'الوقوف غير صحيح (قدم وحدة أو القدم مو في مكانها)' });
  if (scan?.stable === false) issues.push({ code: 'unstable', ar: 'القراءة ما استقرت' });
  if (implausible.length)
    issues.push({ code: 'implausible', ar: 'حرارة غير منطقية. قدمك مبللة؟ كنت تمشي على أرض حارة؟' });
  if (faults.length)
    issues.push({ code: 'fault', ar: 'حساس معطّل: هذي النقطة بدون مقارنة', faults: faults.slice() });

  const used = diff.filter((d): d is number => d !== null);
  // R2 (waiting for Nouran): whole-foot warming is currently treated as a posture error.
  const allBig =
    POLICY.allSitesHot === 'reject' &&
    used.length >= 3 &&
    used.every((d) => Math.abs(d) > THRESH) &&
    (used.every((d) => d > 0) || used.every((d) => d < 0));
  if (allBig)
    issues.push({ code: 'allsites', ar: 'فرق كبير في كل النقاط مرة وحدة: غالبًا خطأ وقوف. أعد الوقوف' });

  const blocking = issues.some((x) => ['standing', 'unstable', 'implausible', 'allsites'].includes(x.code));
  const ok = !blocking && used.length > 0;
  const flagged = ok
    ? diff.map((d, i) => (d !== null && Math.abs(d) > THRESH ? i : -1)).filter((i) => i >= 0)
    : [];
  let maxSite = -1;
  diff.forEach((d, i) => {
    if (d !== null && (maxSite < 0 || Math.abs(d) > Math.abs(diff[maxSite] as number))) maxSite = i;
  });
  return { ok, diff, usable, faults, flagged, maxSite, issues };
}

export type DayMode = 'real' | 'demo';

/** Day key: Riyadh calendar date, or the demo day when demo mode is on. */
export function dayKeyOf(scan: Pick<ScanInput, 'ts' | 'demoDay'>, mode: DayMode = 'real') {
  if (mode === 'demo' && Number.isInteger(scan.demoDay)) {
    return { key: 'D' + scan.demoDay, idx: scan.demoDay as number };
  }
  const local = new Date(Number(scan.ts) + RIYADH_OFFSET_MS);
  const key = local.toISOString().slice(0, 10);
  return { key, idx: Math.floor((Number(scan.ts) + RIYADH_OFFSET_MS) / DAY_MS) };
}

export interface Day {
  key: string;
  idx: number;
  valid: boolean;
  scan: ScanInput;
  check: ScanCheck;
  attempts: number;
}

/**
 * Groups scans by day. scans: an array or a Firebase object (key = id).
 * R5 (waiting for Nouran): each day is represented by its latest valid scan.
 */
export function buildDays(
  scans: ScanInput[] | Record<string, Omit<ScanInput, 'id'>> | null | undefined,
  { mode = 'real' }: { mode?: DayMode } = {},
): Day[] {
  const list: ScanInput[] = Array.isArray(scans)
    ? scans.slice()
    : Object.entries(scans ?? {}).map(([id, s]) => ({ id, ...s }) as ScanInput);
  list.sort((a, b) => Number(a.ts) - Number(b.ts));
  const byKey = new Map<string, { key: string; idx: number; all: { scan: ScanInput; check: ScanCheck }[] }>();
  for (const s of list) {
    if (!s || s.ts == null) continue;
    if (mode === 'demo' && !Number.isInteger(s.demoDay)) continue;
    const { key, idx } = dayKeyOf(s, mode);
    if (!byKey.has(key)) byKey.set(key, { key, idx, all: [] });
    byKey.get(key)!.all.push({ scan: s, check: checkScan(s) });
  }
  return [...byKey.values()]
    .sort((a, b) => a.idx - b.idx)
    .map((d) => {
      const valid = d.all.filter((x) => x.check.ok);
      const pick = valid.length ? valid[valid.length - 1]! : d.all[d.all.length - 1]!;
      return {
        key: d.key,
        idx: d.idx,
        valid: valid.length > 0,
        scan: pick.scan,
        check: pick.check,
        attempts: d.all.length,
      };
    });
}

export type Status = 'normal' | 'watch' | 'alert' | 'invalid';
export type ThermalLevel = 'green' | 'yellow' | 'orange' | 'none';

export interface EvaluatedDay extends Day {
  status: Status;
  level: ThermalLevel;
  streak: number[];
  alertSites: number[];
}

/**
 * Applies the rule day by day.
 * status: normal | watch (above threshold one day) | alert (two consecutive days) | invalid
 * level:  green | yellow | orange | none
 * Red never comes from the sensors. It comes from a patient report and is handled in level.ts.
 */
export function evaluate(days: Day[]): EvaluatedDay[] {
  const out: EvaluatedDay[] = [];
  let prev: EvaluatedDay | null = null;
  for (const d of days) {
    if (!d.valid) {
      out.push({ ...d, status: 'invalid', level: 'none', streak: new Array(N).fill(0), alertSites: [] });
      prev = null; // a day without a valid reading breaks the streak
      continue;
    }
    const consecutive = prev !== null && d.idx === prev.idx + 1;
    const p = prev;
    const streak = d.check.diff.map((v, i) => {
      if (v === null || Math.abs(v) <= THRESH) return 0;
      const sign = Math.sign(v);
      const ps = consecutive && p ? p.check.diff[i] : null;
      const sameSide = ps !== null && ps !== undefined && Math.abs(ps) > THRESH && Math.sign(ps) === sign;
      return sameSide && p ? (p.streak[i] ?? 0) + 1 : 1;
    });
    const alertSites = streak.map((s, i) => (s >= 2 ? i : -1)).filter((i) => i >= 0);
    const status: Status = alertSites.length ? 'alert' : d.check.flagged.length ? 'watch' : 'normal';
    const level = ({ alert: 'orange', watch: 'yellow', normal: 'green' } as const)[status];
    const row: EvaluatedDay = { ...d, status, level, streak, alertSites };
    out.push(row);
    prev = row;
  }
  return out;
}

/** Days without a measurement since the last valid day (for the adherence ladder). nowTs in ms. */
export function daysSinceLastValid(days: Pick<Day, 'valid' | 'idx'>[], nowTs: number): number | null {
  const last = [...days].reverse().find((d) => d.valid);
  if (!last) return null;
  const today = Math.floor((nowTs + RIYADH_OFFSET_MS) / DAY_MS);
  return Math.max(0, today - last.idx);
}

/**
 * Personal baseline (our hypothesis, not from the guidelines): mean difference per site over the
 * first 7 valid days. Display only. It never changes the rule.
 */
export function baseline(days: Day[], n = 7): ({ mean: number; n: number } | null)[] | null {
  const first = days.filter((d) => d.valid).slice(0, n);
  if (!first.length) return null;
  return SITES.map((_, i) => {
    const vals = first.map((d) => d.check.diff[i]).filter((v): v is number => v !== null && v !== undefined);
    if (!vals.length) return null;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    return { mean: round2(mean), n: vals.length };
  });
}

/**
 * One-line Arabic description of a day's result.
 * Wording differs from rules.js on purpose (R8: "يومين متتاليين" instead of "2 أيام"). Logic is identical.
 */
export function describe(row: EvaluatedDay | null | undefined): string {
  if (!row) return '';
  if (row.status === 'invalid') return row.check.issues.map((x) => x.ar).join('، ') || 'لا قراءة صالحة';
  if (row.status === 'normal') return 'لا فرق فوق العتبة';
  const i = (row.alertSites[0] ?? row.check.flagged[0]) as number;
  const d = row.check.diff[i] as number;
  const foot = d > 0 ? 'اليمنى' : 'اليسرى';
  const base = `فرق ${ltr(Math.abs(d).toFixed(1) + '°')} عند ${SITES[i]!.ar} (القدم ${foot} أسخن)`;
  return row.status === 'alert' ? `${base} ${consecutiveDays(row.streak[i] ?? 2)}` : `${base} اليوم فقط`;
}
