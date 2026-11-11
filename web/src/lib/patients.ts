/**
 * One model for any patient shown to the clinic or the family: the real device patient,
 * or the synthetic ("افتراضي") roster. Pure.
 */
import { DAYS_SCENARIOS, generateDays } from '@/data/sim/scenarios';
import type { KhEvent, Photo, Scan } from '@/data/types';
import { priority, type Priority } from './agent/priority';
import { ladderState, type LadderState } from './ladder';
import { withDemoDays } from './demo';
import { buildDayViews, type DayView } from './level';
import { buildDays, DAY_MS, evaluate, type EvaluatedDay } from './rules/rules';

export interface PatientModel {
  id: string;
  name: string;
  age: number | null;
  virtual: boolean;
  scans: Scan[];
  events: KhEvent[];
  photos: Photo[];
  days: EvaluatedDay[];
  views: DayView[];
  today: DayView;
  ladder: LadderState;
  priority: Priority;
}

export function buildPatient(
  p: {
    id: string;
    name: string;
    age: number | null;
    virtual: boolean;
    scans: Scan[];
    events: KhEvent[];
    photos?: Photo[];
  },
  now: number,
  reminderTime = '20:00',
  demo: { on: boolean; since: number | null } = { on: false, since: null },
): PatientModel {
  // Same split as the patient's own screens (store/selectors.ts): the level follows demo mode,
  // the adherence ladder always uses the real calendar.
  const realDays = evaluate(buildDays(p.scans));
  const realViews = buildDayViews(realDays, p.events, { now, demo: false });
  const days = demo.on ? evaluate(buildDays(withDemoDays(p.scans, demo.since), { mode: 'demo' })) : realDays;
  const views = demo.on ? buildDayViews(days, p.events, { now, demo: true }) : realViews;
  const today = views.at(-1)!;
  const ladder = ladderState(realViews, p.events, now, reminderTime);
  const recent = (e: KhEvent) => now - e.ts < 3 * DAY_MS;
  const t = today.thermal;
  const site = t?.alertSites[0] ?? t?.check.flagged[0];
  const pr = priority({
    thermal: t?.status ?? null,
    streak: site !== undefined ? (t?.streak[site] ?? 0) : 0,
    missed: ladder.missed,
    redFlag: p.events.some((e) => e.kind === 'redflag' && recent(e)),
    checkFlag: p.events.some((e) => {
      const d = e.data as { skin?: string; pain?: string } | undefined;
      return (
        e.kind === 'quickcheck' &&
        recent(e) &&
        (d?.skin === 'red' || d?.skin === 'wound' || d?.pain === 'new')
      );
    }),
  });
  return { ...p, photos: p.photos ?? [], days, views, today, ladder, priority: pr };
}

/** Synthetic roster (from the prototype). Every one is labelled "افتراضي" in the UI. */
const ROSTER = [
  { id: 'v1', name: 'أم ناصر', age: 72, scn: 'dropoff' },
  { id: 'v2', name: 'خالد', age: 71, scn: 'developing' },
  { id: 'v3', name: 'سلمى', age: 64, scn: 'healthy' },
  { id: 'v4', name: 'حمدان', age: 66, scn: 'transient' },
  { id: 'v5', name: 'عبدالله', age: 59, scn: 'gaps', redflagDaysAgo: 1 },
] as const;

export function virtualPatients(now: number): PatientModel[] {
  return ROSTER.map((r, k) => {
    const scn = DAYS_SCENARIOS.find((s) => s.id === r.scn)!;
    const scans = generateDays({ ...scn, seed: scn.seed + 100 + k * 17 }, now).map((s, i) => ({
      ...s,
      id: `${r.id}-${i}`,
    }));
    const events: KhEvent[] = [];
    if ('redflagDaysAgo' in r) {
      const ts = now - r.redflagDaysAgo * DAY_MS;
      events.push({
        id: `${r.id}-rf`,
        kind: 'redflag',
        ts,
        data: { why: 'خروج سائل أو دم', text: 'افتراضي' },
      });
    }
    return buildPatient({ id: r.id, name: r.name, age: r.age, virtual: true, scans, events }, now);
  });
}

/** Real patient first (always on top), then the synthetic ones by priority. */
export function orderPatients(real: PatientModel, virtual: PatientModel[]): PatientModel[] {
  return [real, ...[...virtual].sort((a, b) => b.priority.score - a.priority.score)];
}
