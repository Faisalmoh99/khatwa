import { expect, test } from 'vitest';
import type { KhEvent, Scan } from '@/data/types';
import { buildPatient, orderPatients, virtualPatients } from './patients';
import { coverageNote } from './quality';
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

test('virtual roster: labelled virtual; whole list by priority, red above orange, device patient wins ties', () => {
  const now = Date.UTC(2026, 10, 8, 12);
  const v = virtualPatients(now);
  expect(v).toHaveLength(5);
  expect(v.every((p) => p.virtual)).toBe(true);
  const real = buildPatient(
    { id: 'real', name: 'مريض خطوة 01', age: null, virtual: false, scans: [], events: [] },
    now,
  );
  const list = orderPatients(real, v);
  const scores = list.map((p) => p.priority.score);
  expect(scores).toEqual([...scores].sort((a, b) => b - a));
  // red, orange, yellow lead; green, no reading and paused are then ordered by their points (missed days first)
  const rank = { red: 3, orange: 2, yellow: 1, green: 0, none: 0, paused: 0 } as const;
  const levels = list.map((p) => rank[p.today.level]);
  expect(levels).toEqual([...levels].sort((a, b) => b - a)); // red, then orange, then yellow…
  // a red device patient goes above the orange Abdullah, whatever their points
  const redReal = buildPatient(
    {
      id: 'real',
      name: 'مريض خطوة 01',
      age: null,
      virtual: false,
      scans: [],
      events: [{ id: 'rf', kind: 'redflag', ts: now - 60_000, day: '2026-11-08', data: { why: 'تورم' } }],
    },
    now,
  );
  expect(redReal.today.level).toBe('red');
  expect(orderPatients(redReal, v)[0]!.id).toBe('real');
  expect(list.find((p) => p.name === 'عبدالله')!.priority.parts.map((x) => x.label)).toContain(
    'علامة خطر من المريض',
  );
});

test('summary payload has numbers and reasons only, and the template fallback reads correctly', async () => {
  const { summaryPayload, templateSummary } = await import('./report');
  const scans = [scan(0), scan(1, 2.5), scan(2, 2.6)];
  const p = buildPatient(
    { id: 'real', name: 'أبو سعد', age: null, virtual: false, scans, events: [] },
    T0 + 2 * DAY + 1000,
  );
  const r = buildReport(p);
  const payload = JSON.stringify(summaryPayload(r));
  expect(payload).not.toContain('أبو سعد');
  expect(payload).not.toMatch(/[⁦-⁩]/);
  const t = templateSummary(r);
  expect(t).toContain('3 أيام');
  expect(t).toContain('الالتزام 100%');
});

test('demo mode: the family/clinic/report patient follows demo days like the patient screens', () => {
  const now = T0 + 1000 * 60;
  const since = T0 - 1000;
  // Two hot scans minutes apart (same real day). Demo mode = one day each → orange.
  const hot = [
    { ...scan(0, 2.6), id: 'a' },
    { ...scan(0, 2.7), id: 'b', ts: T0 + 30_000 },
  ];
  const base = { id: 'real', name: 'مريض', age: null, virtual: false, scans: hot, events: [] };
  const real = buildPatient(base, now);
  expect(real.today.level).toBe('yellow');
  const demo = buildPatient(base, now, '20:00', { on: true, since });
  expect(demo.today.level).toBe('orange');
  expect(buildReport(demo).last.level).toBe('orange');
  // The adherence ladder keeps the real calendar.
  expect(demo.ladder).toEqual(real.ladder);
});

test('a faulty sensor is stated in the report and never hidden behind a green title', () => {
  const s = { ...scan(0), L: [31, -127, 29.5, 30.5] };
  const p = buildPatient(
    { id: 'real', name: 'م', age: null, virtual: false, scans: [s], events: [] },
    T0 + 1000,
  );
  expect(p.today.level).toBe('green');
  expect(buildReport(p).coverage).toBe('قسنا 7 من 8 نقاط. حساس رأس المشط الأول، القدم اليسرى معطّل.');
  expect(buildReport(buildPatient({ ...p, scans: [scan(0)] }, T0 + 1000)).coverage).toBeNull();
});

test('coverage note: several faulty sensors', () => {
  expect(coverageNote({ faults: ['L0', 'R3'] })).toBe(
    'قسنا 6 من 8 نقاط. حساس الإبهام، القدم اليسرى وحساس الكعب، القدم اليمنى معطّلة.',
  );
  expect(coverageNote({ faults: [] })).toBeNull();
  expect(coverageNote(null)).toBeNull();
});
