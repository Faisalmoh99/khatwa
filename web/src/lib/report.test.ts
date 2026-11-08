import { expect, test } from 'vitest';
import type { KhEvent, Scan } from '@/data/types';
import { buildPatient, orderPatients, virtualPatients } from './patients';
import { buildReport } from './report';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 1, 5);
const scan = (n: number, d1 = 0): Scan => ({
  id: String(n),
  ts: T0 + n * DAY,
  L: [31, 30, 29.5, 30.5],
  R: [31, 30 + d1, 29.5, 30.5],
  standingOk: true,
  stable: true,
  source: 'esp32',
});

test('report counts levels, adherence, episodes and site flags from real data', () => {
  const scans = [scan(0), scan(1), scan(2, 2.5), scan(3, 2.6), scan(4, 2.7), scan(6)];
  const ev: KhEvent[] = [
    { id: 'q', kind: 'quickcheck', ts: T0 + 5 * DAY, data: { skin: 'red', pain: 'new', care: 'skip' } },
  ];
  const p = buildPatient(
    { id: 'real', name: 'مريض', age: null, virtual: false, scans, events: ev },
    T0 + 6 * DAY + 1000,
  );
  const r = buildReport(p);
  expect(r.periodDays).toBe(7);
  expect(r.measured).toBe(7); // day 5 = quick check
  expect(r.adherencePct).toBe(100);
  expect(r.counts.orange).toBe(2);
  expect(r.episodes).toHaveLength(1);
  expect(r.episodes[0]).toMatchObject({ level: 'orange', days: 2, where: 'رأس المشط الأول، القدم اليمنى' });
  expect(r.siteFlags[1]).toEqual({ site: 'رأس المشط الأول', L: 0, R: 3 });
  expect(r.quick).toEqual({ total: 1, skin: 1, pain: 1, skippedCare: 1 });
  expect(r.simulated).toBe(false);
  expect(r.episodes[0]!.why).not.toMatch(/[⁦-⁩]/);
});

test('virtual roster: labelled virtual, real patient always first', () => {
  const now = Date.UTC(2026, 10, 8, 12);
  const v = virtualPatients(now);
  expect(v).toHaveLength(5);
  expect(v.every((p) => p.virtual)).toBe(true);
  const real = buildPatient(
    { id: 'real', name: 'مريض خطوة 01', age: null, virtual: false, scans: [], events: [] },
    now,
  );
  const list = orderPatients(real, v);
  expect(list[0]!.id).toBe('real');
  const scores = list.slice(1).map((p) => p.priority.score);
  expect(scores).toEqual([...scores].sort((a, b) => b - a));
  expect(list.find((p) => p.name === 'عبدالله')!.priority.parts.map((x) => x.label)).toContain(
    'علامة خطر من المريض',
  );
});
