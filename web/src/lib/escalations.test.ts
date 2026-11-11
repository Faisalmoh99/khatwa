import { expect, test } from 'vitest';
import type { KhEvent } from '@/data/types';
import { dueEscalations, unwritten } from './escalations';
import { buildDayViews, type DayView } from './level';
import { buildDays, evaluate, type ScanInput } from './rules/rules';
import { familyEmptyText } from './words';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 1, 5);
const scan = (n: number, d = [0, 0, 0, 0]): ScanInput => ({
  ts: T0 + n * DAY,
  L: [31, 30, 29.5, 30.5],
  R: [31, 30 + d[1]!, 29.5, 30.5],
  standingOk: true,
  stable: true,
});
const views = (s: ScanInput[], ev: KhEvent[] = [], now = Number(s.at(-1)?.ts ?? T0) + 1000): DayView[] =>
  buildDayViews(evaluate(buildDays(s)), ev, { now, demo: false });
const L0 = { step: 1 as const, missed: 0, paused: false, todayDone: true };
const opt = { familyConsent: true, realDayKey: 'R' };

test('first orange day → patient + family, not clinic', () => {
  const v = views([scan(0, [0, 2.5]), scan(1, [0, 2.6])]);
  const d = dueEscalations(v, L0, opt);
  expect(d.map((e) => `${e.to}:${e.reason}`)).toEqual(['patient:thermal', 'family:thermal']);
});

test('third orange day → clinic, family not repeated', () => {
  const v = views([scan(0, [0, 2.5]), scan(1, [0, 2.6]), scan(2, [0, 2.7]), scan(3, [0, 2.7])]);
  expect(dueEscalations(v, L0, opt).map((e) => `${e.to}:${e.reason}`)).toEqual([
    'patient:thermal',
    'clinic:thermal_persist',
  ]);
});

test('red → patient, family and clinic (urgent)', () => {
  const ev: KhEvent = {
    id: 'q',
    kind: 'quickcheck',
    ts: T0 + 500,
    data: { skin: 'wound', pain: 'ok', care: 'done' },
    day: '2026-11-01',
  };
  const d = dueEscalations(views([scan(0)], [ev]), L0, opt);
  expect(d.map((e) => e.to)).toEqual(['patient', 'family', 'clinic']);
  expect(d.find((e) => e.to === 'clinic')!.urgent).toBe(true);
});

test('no family alert without consent', () => {
  const v = views([scan(0, [0, 2.5]), scan(1, [0, 2.6])]);
  expect(dueEscalations(v, L0, { ...opt, familyConsent: false }).map((e) => e.to)).toEqual(['patient']);
});

test('adherence: 1 day → patient reminder, 2 → family, 3 → clinic, 4 → nothing new, 6 → clinic again', () => {
  const v = views([scan(0)]);
  const at = (step: 1 | 2 | 3 | 4, missed: number) =>
    dueEscalations(v.slice(0, 0), { step, missed, paused: false, todayDone: false }, opt).map(
      (e) => `${e.to}:${e.reason}`,
    );
  expect(at(2, 1)).toEqual(['patient:reminder']);
  expect(at(3, 2)).toEqual(['family:adherence']);
  expect(at(4, 3)).toEqual(['clinic:adherence']);
  expect(at(4, 4)).toEqual([]);
  expect(at(4, 6)).toEqual(['clinic:adherence']);
});

test('pause mode stops adherence and thermal escalations', () => {
  const v = views([scan(0, [0, 2.5]), scan(1, [0, 2.6])]);
  expect(dueEscalations(v, { step: 4, missed: 3, paused: true, todayDone: false }, opt)).toEqual([]);
});

test('unwritten() dedupes by key so a reload never writes twice', () => {
  const v = views([scan(0, [0, 2.5]), scan(1, [0, 2.6])]);
  const d = dueEscalations(v, L0, opt);
  const written: KhEvent[] = [{ id: 'x', kind: 'escalation', ts: 1, data: { key: d[0]!.key } }];
  expect(unwritten(d, written).map((e) => e.key)).toEqual([d[1]!.key]);
});

test('clinic escalation text uses the right Arabic day word', () => {
  const s = [0, 1, 2, 3].map((n) => scan(n, [0, 2.5 + n / 10]));
  const clinic = dueEscalations(views(s), L0, opt).find((e) => e.to === 'clinic');
  expect(clinic?.why).toContain('(منذ 3 أيام)');
  const long = Array.from({ length: 12 }, (_, n) => scan(n, [0, 2.5]));
  expect(dueEscalations(views(long), L0, opt).find((e) => e.to === 'clinic')?.why).toContain(
    '(منذ 11 يومًا)',
  );
});

test('family empty alert list never says "الحمد لله" on an orange or red day', () => {
  expect(familyEmptyText('orange')).toBe('ما فيه تنبيهات جديدة.');
  expect(familyEmptyText('red')).toBe('ما فيه تنبيهات جديدة.');
  expect(familyEmptyText('green')).toContain('الحمد لله');
});
