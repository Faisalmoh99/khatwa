/**
 * Simulation scenarios. Live scenarios mirror app/sim/index.html exactly (same numbers),
 * so a scan from the in-browser simulator looks like one from the Firebase simulator or the ESP32.
 * Everything produced here is labelled "simulation" in the UI.
 */
import type { Scan } from '../types';

/** Baseline skin temperature per site (°C): hallux, MTH1, MTH5, heel. Same as app/sim. */
export const SKIN = [30.8, 31.2, 30.6, 29.9] as const;

export interface LiveScenario {
  id: string;
  ar: string;
  dR: [number, number, number, number];
  oneFoot?: boolean;
  move?: boolean;
  wet?: boolean;
  fault?: { foot: 'L' | 'R'; i: number };
}

export const LIVE_SCENARIOS: LiveScenario[] = [
  { id: 'normal', ar: 'طبيعي (فرق صغير)', dR: [0.2, -0.3, 0.1, 0.2] },
  { id: 'hot', ar: 'نقطة ساخنة: رأس المشط الأول، اليمنى +2.6°', dR: [0.1, 2.6, 0.2, 0.0] },
  { id: 'hotL', ar: 'نقطة ساخنة: الكعب، اليسرى +2.8°', dR: [0.1, -0.2, 0.1, -2.8] },
  { id: 'edge', ar: 'حدّي: الإبهام، اليمنى +2.0° (ما ينبّه)', dR: [2.0, 0.1, -0.1, 0.2] },
  { id: 'one', ar: 'يقف على قدم وحدة (يُرفض)', dR: [0, 0, 0, 0], oneFoot: true },
  { id: 'move', ar: 'يتحرك أثناء القياس', dR: [0.2, -0.1, 0.1, 0.1], move: true },
  { id: 'wet', ar: 'قدمان مبللتان', dR: [0.1, 0.2, -0.1, 0.1], wet: true },
  {
    id: 'fault',
    ar: 'حساس معطّل: رأس المشط الخامس اليسرى',
    dR: [0.2, -0.2, 0.1, 0.1],
    fault: { foot: 'L', i: 2 },
  },
  { id: 'allsites', ar: 'كل النقاط فرقها كبير (خطأ وقوف)', dR: [2.9, 3.1, 2.7, 3.0] },
];

/** Same thresholds as the ESP32 firmware and app/sim (tuned after hardware tests). */
export const FSR_ON = 1800;
export const FSR_MIN = 600;
export const STABLE_WIN = 5;
export const STABLE_DELTA = 0.1;
export const MIN_SEC = 8;
export const MAX_SEC = 90;

export function mulberry32(a: number) {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const r2 = (v: number) => Math.round(v * 100) / 100;

/** 30-day history scenarios (4-site port of the prototype's Engine.SCENARIOS, temperature only). */
export interface DaysScenario {
  id: string;
  ar: string;
  desc: string;
  seed: number;
  hot: (d: number) => { foot: 'L' | 'R'; site: number; add: number }[];
  missing: number[];
}

const ramp = (start: number, rate: number, cap: number) => (d: number) =>
  d < start ? 0 : Math.min(cap, (d - start + 1) * rate);

export const DAYS_SCENARIOS: DaysScenario[] = [
  { id: 'healthy', ar: 'سليم', desc: 'ثلاثون يومًا بلا نقطة ساخنة.', seed: 11, hot: () => [], missing: [] },
  {
    id: 'developing',
    ar: 'نقطة تسخن تدريجيًا',
    desc: 'رأس المشط الأول في القدم اليمنى يسخن من اليوم 8.',
    seed: 23,
    hot: (d) => {
      const a = ramp(8, 0.6, 3.8)(d);
      return a ? [{ foot: 'R', site: 1, add: a }] : [];
    },
    missing: [],
  },
  {
    id: 'transient',
    ar: 'قراءة عابرة',
    desc: 'كعب القدم اليمنى يسخن يومًا واحدًا بعد مشي طويل ثم يهدأ.',
    seed: 37,
    hot: (d) =>
      d === 12 ? [{ foot: 'R', site: 3, add: 2.9 }] : d === 13 ? [{ foot: 'R', site: 3, add: 0.9 }] : [],
    missing: [],
  },
  {
    id: 'gaps',
    ar: 'أيام ناقصة',
    desc: 'إبهام القدم اليسرى يسخن، والمريض ينسى القياس يومين.',
    seed: 53,
    hot: (d) => {
      const a = ramp(9, 0.8, 3.6)(d);
      return a ? [{ foot: 'L', site: 0, add: a }] : [];
    },
    missing: [12, 13, 20],
  },
  {
    id: 'dropoff',
    ar: 'توقّف عن القياس',
    desc: 'يلتزم أسبوعين ثم يتوقف من اليوم 16. هنا يظهر سلّم المتابعة.',
    seed: 79,
    hot: () => [],
    missing: Array.from({ length: 15 }, (_, i) => 16 + i),
  },
  ...[1, 2, 3].map((gap) => ({
    id: `stop${gap}`,
    ar: gap === 1 ? 'ما قاس اليوم' : gap === 2 ? 'ما قاس من يومين' : 'ما قاس من 3 أيام',
    desc: 'سليم، ثم توقف عن القياس. يوضّح سلّم المتابعة.',
    seed: 11,
    hot: () => [],
    missing: Array.from({ length: gap }, (_, i) => 30 - i),
  })),
];

/**
 * Generates `days` days of scans ending today (one scan per day at 08:00 Riyadh time).
 * Every scan carries backfill:true and scenario so it can never be mistaken for a real reading.
 */
export function generateDays(scn: DaysScenario, nowTs: number, days = 30): Omit<Scan, 'id'>[] {
  const out: Omit<Scan, 'id'>[] = [];
  const DAY = 86_400_000;
  const prof = mulberry32(scn.seed * 9973);
  const asym = SKIN.map(() => (prof() - 0.5) * 0.4);
  // Anchor at 08:00 Riyadh (05:00 UTC) of today
  const today = new Date(nowTs);
  const anchor = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate(), 5, 0, 0);
  for (let d = 1; d <= days; d++) {
    if (scn.missing.includes(d)) continue;
    const rng = mulberry32(scn.seed * 1000 + d);
    const common = (rng() - 0.5) * 1.2;
    const L = SKIN.map((v, i) => r2(v + common + (rng() - 0.5) * 0.4 - asym[i]! / 2));
    const R = SKIN.map((v, i) => r2(v + common + (rng() - 0.5) * 0.4 + asym[i]! / 2));
    for (const h of scn.hot(d))
      (h.foot === 'R' ? R : L)[h.site] = r2((h.foot === 'R' ? R : L)[h.site]! + h.add);
    const ts = anchor - (days - d) * DAY;
    if (ts > nowTs) continue;
    out.push({
      L,
      R,
      diff: L.map((v, i) => r2(R[i]! - v)),
      standingOk: true,
      stable: true,
      durationSec: 40 + Math.round(rng() * 15),
      faults: [],
      source: 'sim',
      firmware: 'sim-web-0.2.0',
      backfill: true,
      scenario: scn.id,
      ts,
    });
  }
  return out;
}
