import { expect, test } from 'vitest';
import type { KhEvent } from '@/data/types';
import { buildDayViews } from './level';
import { ladderState, ladderText, riyadhMinutes } from './ladder';
import { buildDays, evaluate, type ScanInput } from './rules/rules';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 1, 5); // 1 Nov 08:00 Riyadh
const scan = (n: number): ScanInput => ({
  ts: T0 + n * DAY,
  L: [31, 30, 29.5, 30.5],
  R: [31, 30, 29.5, 30.5],
  standingOk: true,
  stable: true,
});
const at = (dayN: number, hour: number) => Date.UTC(2026, 10, 1 + dayN, hour - 3); // Riyadh hour

function state(scanDays: number[], now: number, events: KhEvent[] = []) {
  const views = buildDayViews(evaluate(buildDays(scanDays.map(scan))), events, { now, demo: false });
  return ladderState(views, events, now, '20:00');
}

test('riyadhMinutes', () => {
  expect(riyadhMinutes(at(0, 20))).toBe(20 * 60);
});

test('measured today = step 1', () => {
  expect(state([0, 1, 2], at(2, 10))).toMatchObject({ step: 1, missed: 0, todayDone: true });
});

test('today not measured yet in the morning is not missed', () => {
  expect(state([0, 1], at(2, 10))).toMatchObject({ step: 1, missed: 0 });
});

test('after the reminder time, today counts: one day = step 2 (reminder)', () => {
  expect(state([0, 1], at(2, 21))).toMatchObject({ step: 2, missed: 1 });
});

test('two days = step 3 (family), three days = step 4 (clinic)', () => {
  expect(state([0], at(2, 21))).toMatchObject({ step: 3, missed: 2 });
  expect(state([0], at(3, 21))).toMatchObject({ step: 4, missed: 3 });
  expect(state([0], at(5, 10))).toMatchObject({ step: 4, missed: 4 });
});

test('a quick check counts as a measured day', () => {
  const qc: KhEvent = {
    id: 'q',
    kind: 'quickcheck',
    ts: at(2, 9),
    data: { skin: 'ok', pain: 'ok', care: 'done' },
  };
  expect(state([0], at(2, 21), [qc])).toMatchObject({ step: 1, missed: 0, todayDone: true });
});

test('travel mode pauses the ladder and its days are not counted', () => {
  const travel: KhEvent = { id: 't', kind: 'mode', ts: at(1, 9), data: { mode: 'travel' } };
  const back: KhEvent = { id: 'b', kind: 'mode', ts: at(4, 9), data: { mode: 'normal' } };
  expect(state([0], at(3, 21), [travel])).toMatchObject({ paused: true, step: 1 });
  expect(state([0], at(4, 21), [travel, back])).toMatchObject({ paused: false, missed: 1, step: 2 });
});

test('no measurement ever = fresh start', () => {
  expect(state([], at(0, 21))).toMatchObject({ fresh: true, step: 1 });
});

test('ladder text uses correct Arabic', () => {
  expect(
    ladderText({ step: 3, missed: 2, paused: false, mode: 'normal', fresh: false, todayDone: false }),
  ).toContain('يومين');
  expect(
    ladderText({ step: 4, missed: 3, paused: false, mode: 'normal', fresh: false, todayDone: false }),
  ).toContain('3 أيام');
});

test('family and clinic get third-person ladder text', () => {
  const base = { paused: false, mode: 'normal' as const, fresh: false, todayDone: false };
  expect(ladderText({ ...base, step: 3, missed: 2 }, 'other')).toBe('يومين بدون قياس.');
  expect(ladderText({ ...base, step: 1, missed: 0, fresh: true }, 'other')).toBe('ما بدأ القياس بعد.');
  expect(ladderText({ ...base, step: 4, missed: 3 }, 'other')).toContain('أُبلغت العيادة');
});
