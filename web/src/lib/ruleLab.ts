/**
 * Rule lab: compares false alarms and detection between alert rules on SYNTHETIC patients.
 * Every number here comes from our own assumptions (ASSUME), not from patient data.
 *
 * 4-site port of the prototype's Engine.cohort, temperature only (no pressure, no perfusion).
 * Rule A is the real engine (rules.ts: > 2.2°, same site, same warmer foot, 2 consecutive days).
 * The alternatives use the same "greater than" and "same foot" conditions for a fair comparison.
 */
import { mulberry32 } from '@/data/sim/scenarios';
import { buildDays, DAY_MS, evaluate, type ScanInput, THRESH } from './rules/rules';

export const LAB_DAYS = 30;
const N = 4;
/** Skin temperature per site (°C): hallux, MTH1, MTH5, heel. Same as the simulator. */
const BASE = [30.8, 31.2, 30.6, 29.9];
/** Cooling right after wudu, wetter foot / drier foot (°C). Mapped from the prototype's 8-site table. */
const WET_HI = [3.6, 2.8, 2.2, 0.8];
const WET_LO = [1.0, 0.9, 0.9, 0.4];

export const ASSUME = [
  'الفرق الطبيعي بين القدمين عند كل مريض: انحراف معياري 0.4° ثابت، وضجيج الحساس 0.3° لكل قراءة.',
  'حرارة الغرفة تأثر على القدمين مع بعض (±0.8°) فتنلغي عند أخذ الفرق.',
  '3% من الأيام فيها ارتفاع عابر 2.3–3.3° في نقطة وحدة بسبب النشاط.',
  '30% من القراءات تنأخذ والقدم مبللة لو ما فيه انتظار واستقرار. البلل يبرّد الإبهام 3.6° مقابل 1.0° للقدم الثانية.',
  'نسبة الأيام الفائتة 8%، وترتفع إلى 15% مع الانتظار والاستقرار لأنه أطول على المريض. الغياب مستقل بين الأيام (في الواقع يتجمّع، وهذا يجمّل القاعدة أ).',
  '15% من المرضى تبدأ عندهم نقطة ساخنة بين اليوم 8 و15، بمعدل 0.25–0.7° يوميًا وسقف 2.0–4.0°.',
];

export type LabRule = 'single' | 'two' | 'window';
export interface LabRuleCfg {
  key: string;
  label: string;
  rule: LabRule;
  proto: boolean;
}
export const LAB_RULES: LabRuleCfg[] = [
  { key: 'single', label: 'يوم واحد', rule: 'single', proto: false },
  { key: 'two', label: 'أ: يومان متتاليان (قاعدتنا)', rule: 'two', proto: false },
  { key: 'window', label: 'ب: يومان من ثلاثة', rule: 'window', proto: false },
  { key: 'twoProto', label: 'أ + انتظار واستقرار', rule: 'two', proto: true },
  { key: 'windowProto', label: 'ب + انتظار واستقرار', rule: 'window', proto: true },
];

function gauss(r: () => number) {
  let u = 0;
  while (u === 0) u = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}
const mix = (a: number, b: number) =>
  (Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x7f4a7c15, 0xc2b2ae35)) >>> 0;
const ramp = (start: number, rate: number, cap: number) => (d: number) =>
  d < start ? 0 : Math.min(cap, (d - start + 1) * rate);

interface Patient {
  seed: number;
  hot: { foot: 'L' | 'R'; site: number; at: (d: number) => number } | null;
}

/** One day's reading (L, R) for a synthetic patient. */
function read(
  p: Patient,
  d: number,
  o: { noise: number; wetProb: number; transientProb: number; proto: boolean },
) {
  const rng = mulberry32(mix(p.seed, d));
  const prof = mulberry32(mix(p.seed, 9999));
  const asym = BASE.map(() => gauss(prof) * 0.4);
  const common = gauss(rng) * 0.8;
  const nL = BASE.map(() => gauss(rng));
  const nR = BASE.map(() => gauss(rng));
  const u1 = rng();
  const u2 = rng();
  const flip = rng() < 0.5;
  const ev = rng();
  const evSite = Math.floor(rng() * N);
  const evFoot = rng() < 0.5 ? 'R' : 'L';
  const evAmt = 2.3 + rng() * 1.0;
  const r = o.proto ? 0.04 + 0.06 * u2 : u1 < o.wetProb ? 0.5 + 0.5 * u2 : 0;
  const L: number[] = [];
  const R: number[] = [];
  for (let i = 0; i < N; i++) {
    const wr = (flip ? WET_HI[i]! : WET_LO[i]!) * r;
    const wl = (flip ? WET_LO[i]! : WET_HI[i]!) * r;
    L.push(BASE[i]! + common + nL[i]! * o.noise - asym[i]! / 2 - wl);
    R.push(BASE[i]! + common + nR[i]! * o.noise + asym[i]! / 2 - wr);
  }
  if (p.hot) (p.hot.foot === 'R' ? R : L)[p.hot.site]! += p.hot.at(d);
  if (ev < o.transientProb) (evFoot === 'R' ? R : L)[evSite]! += evAmt;
  return { L: L.map((v) => Math.round(v * 100) / 100), R: R.map((v) => Math.round(v * 100) / 100) };
}

/** Alert sites per day (index 0 = day 1). Missing days have null. */
export function labTimeline(scans: (ScanInput | null)[], rule: LabRule): (number[] | null)[] {
  if (rule === 'two') {
    const days = evaluate(buildDays(scans.filter((s): s is ScanInput => s !== null)));
    const byIdx = new Map(days.map((d) => [d.idx, d.alertSites]));
    return scans.map((s) => (s ? (byIdx.get(Math.floor(Number(s.ts) / DAY_MS)) ?? []) : null));
  }
  const flagged = scans.map((s) => {
    if (!s) return null;
    const L = s.L as number[];
    const R = s.R as number[];
    // Same rounding as rules.ts (2 decimals) so 2.2 exactly is never flagged.
    return L.map((l, i) => Math.round((R[i]! - l) * 100) / 100)
      .map((d, i) => (Math.abs(d) > THRESH ? { i, sign: Math.sign(d) } : null))
      .filter((x) => x !== null);
  });
  return flagged.map((f, k) => {
    if (!f) return null;
    if (rule === 'single') return f.map((x) => x.i);
    const same = (j: number, x: { i: number; sign: number }) =>
      j >= 0 && !!flagged[j]?.some((y) => y.i === x.i && y.sign === x.sign);
    return f.filter((x) => same(k - 1, x) || same(k - 2, x)).map((x) => x.i);
  });
}

export interface LabResult {
  key: string;
  label: string;
  falsePer100: number;
  sensitivity: number;
  medianDelay: number | null;
  hot: number;
  healthy: number;
}

export function runCohort(cfg: Partial<{ n: number; seed: number; noise: number }> = {}): LabResult[] {
  const c = {
    n: 400,
    hotFrac: 0.15,
    noise: 0.3,
    wetProb: 0.3,
    transientProb: 0.03,
    missBase: 0.08,
    missProto: 0.15,
    seed: 2026,
    ...cfg,
  };
  const rng = mulberry32(c.seed);
  const acc = LAB_RULES.map(() => ({
    hot: 0,
    detected: 0,
    delays: [] as number[],
    healthy: 0,
    falseEpisodes: 0,
  }));
  for (let p = 0; p < c.n; p++) {
    const isHot = rng() < c.hotFrac;
    const rate = 0.25 + rng() * 0.45;
    const cap = 2.0 + rng() * 2.0;
    const onset = 8 + Math.floor(rng() * 8);
    const site = Math.floor(rng() * N);
    const foot = rng() < 0.5 ? 'R' : 'L';
    const pt: Patient = {
      seed: 100000 + p * 7,
      hot: isHot ? { foot, site, at: ramp(onset, rate, cap) } : null,
    };
    LAB_RULES.forEach((r, k) => {
      const mrng = mulberry32(mix(pt.seed, 5));
      const mp = r.proto ? c.missProto : c.missBase;
      const scans: (ScanInput | null)[] = [];
      for (let d = 1; d <= LAB_DAYS; d++) {
        if (mrng() < mp) {
          scans.push(null);
          continue;
        }
        const m = read(pt, d, {
          noise: c.noise,
          wetProb: c.wetProb,
          transientProb: c.transientProb,
          proto: r.proto,
        });
        scans.push({ ts: d * DAY_MS + 5 * 3_600_000, L: m.L, R: m.R, standingOk: true, stable: true });
      }
      const tl = labTimeline(scans, r.rule);
      const a = acc[k]!;
      if (isHot) {
        a.hot++;
        const hit = tl.findIndex((s, i) => i + 1 >= onset && !!s?.includes(site));
        if (hit >= 0) {
          a.detected++;
          a.delays.push(hit + 1 - onset);
        }
      } else {
        a.healthy++;
        let prev = false;
        for (const s of tl) {
          const on = !!s && s.length > 0;
          if (on && !prev) a.falseEpisodes++;
          prev = on;
        }
      }
    });
  }
  const med = (x: number[]) => (x.length ? [...x].sort((a, b) => a - b)[Math.floor(x.length / 2)]! : null);
  return LAB_RULES.map((r, k) => {
    const a = acc[k]!;
    return {
      key: r.key,
      label: r.label,
      falsePer100: a.healthy ? (a.falseEpisodes / a.healthy) * 100 : 0,
      sensitivity: a.hot ? a.detected / a.hot : 0,
      medianDelay: med(a.delays),
      hot: a.hot,
      healthy: a.healthy,
    };
  });
}
