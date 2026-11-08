import { describe, expect, test } from 'vitest';
import type { KhEvent } from '@/data/types';
import { buildDayViews, focusSite, levelOf, modeAt, nextSteps, todayKeyOf } from './level';
import { buildDays, evaluate, type ScanInput } from './rules/rules';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 10, 5); // 08:00 Riyadh
const base = [31, 30, 29.5, 30.5];
const scan = (n: number, d = [0, 0, 0, 0], extra: Partial<ScanInput> = {}): ScanInput => ({
  ts: T0 + n * DAY,
  L: base.slice(),
  R: base.map((v, i) => +(v + d[i]!).toFixed(2)),
  standingOk: true,
  stable: true,
  ...extra,
});
const ev = (kind: KhEvent['kind'], ts: number, data: Record<string, unknown>, day?: string): KhEvent => ({
  id: `${kind}-${ts}`,
  kind,
  ts,
  data,
  ...(day ? { day } : {}),
});
const days = (...s: ScanInput[]) => evaluate(buildDays(s));

describe('levelOf: red only from patient reports', () => {
  test('thermal orange stays orange without a report (sensors never give red)', () => {
    const t = days(scan(0, [0, 2.5, 0, 0]), scan(1, [0, 2.6, 0, 0]))[1]!;
    expect(levelOf(t, null, [], 'normal').level).toBe('orange');
  });
  test('huge thermal difference is still not red', () => {
    const t = days(scan(0, [0, 6, 0, 0]), scan(1, [0, 6, 0, 0]))[1]!;
    expect(levelOf(t, null, [], 'normal').level).toBe('orange');
  });
  test('wound in the quick check = red', () => {
    expect(levelOf(null, { skin: 'wound', pain: 'ok', care: 'done' }, [], 'normal').level).toBe('red');
  });
  test('red flag in chat = red', () => {
    const r = levelOf(days(scan(0))[0]!, null, ['خروج سائل أو دم'], 'normal');
    expect(r.level).toBe('red');
    expect(r.reasons[0]!.ar).toContain('خروج سائل');
  });
  test('redness or new pain = at least yellow, never lowers orange', () => {
    expect(levelOf(days(scan(0))[0]!, { skin: 'red', pain: 'ok', care: 'done' }, [], 'normal').level).toBe(
      'yellow',
    );
    expect(levelOf(null, { skin: 'ok', pain: 'new', care: 'done' }, [], 'normal').level).toBe('yellow');
    const t = days(scan(0, [0, 2.5, 0, 0]), scan(1, [0, 2.6, 0, 0]))[1]!;
    expect(levelOf(t, { skin: 'ok', pain: 'ok', care: 'done' }, [], 'normal').level).toBe('orange');
  });
  test('quick check alone (no scan) and all fine = green', () => {
    expect(levelOf(null, { skin: 'ok', pain: 'ok', care: 'done' }, [], 'normal').level).toBe('green');
  });
  test('nothing measured = none', () => {
    expect(levelOf(null, null, [], 'normal').level).toBe('none');
  });
  test('invalid scan = none with the reason', () => {
    const t = days(scan(0, [0, 0, 0, 0], { standingOk: false }))[0]!;
    const r = levelOf(t, null, [], 'normal');
    expect(r.level).toBe('none');
    expect(r.reasons[0]!.code).toBe('invalid');
  });
});

describe('pause modes', () => {
  test('bandage and hospital pause the day', () => {
    const t = days(scan(0, [0, 2.5, 0, 0]))[0]!;
    expect(levelOf(t, null, [], 'bandage').level).toBe('paused');
    expect(levelOf(null, null, [], 'hospital').level).toBe('paused');
  });
  test('travel pauses only a day without measurement', () => {
    expect(levelOf(null, null, [], 'travel').level).toBe('paused');
    expect(levelOf(days(scan(0))[0]!, null, [], 'travel').level).toBe('green');
  });
  test('a red report is still red during a pause (safer)', () => {
    expect(levelOf(null, { skin: 'wound', pain: 'ok', care: 'done' }, [], 'hospital').level).toBe('red');
  });
  test('modeAt picks the latest mode event at that time', () => {
    const e = [ev('mode', 100, { mode: 'travel' }), ev('mode', 200, { mode: 'normal' })];
    expect(modeAt(e, 50)).toBe('normal');
    expect(modeAt(e, 150)).toBe('travel');
    expect(modeAt(e, 250)).toBe('normal');
  });
});

describe('buildDayViews', () => {
  test('quick check event attaches to its day and makes it red', () => {
    const d = days(scan(0));
    const views = buildDayViews(
      d,
      [ev('quickcheck', T0 + 1000, { skin: 'wound', pain: 'ok', care: 'done' }, '2026-11-10')],
      {
        now: T0 + 2000,
        demo: false,
      },
    );
    expect(views).toHaveLength(1);
    expect(views[0]!.level).toBe('red');
    expect(views[0]!.done).toBe(true);
  });
  test('today exists even with nothing measured', () => {
    const views = buildDayViews(days(scan(0)), [], { now: T0 + 2 * DAY, demo: false });
    expect(views.map((v) => v.key)).toEqual(['2026-11-10', '2026-11-12']);
    expect(views[1]!.level).toBe('none');
    expect(views[1]!.done).toBe(false);
  });
  test('quick check without a scan counts as done (adherence)', () => {
    const views = buildDayViews([], [ev('quickcheck', T0, { skin: 'ok', pain: 'ok', care: 'done' })], {
      now: T0 + 1,
      demo: false,
    });
    expect(views[0]!.done).toBe(true);
    expect(views[0]!.level).toBe('green');
  });
  test('demo mode: today = latest demo day', () => {
    const d = evaluate(
      buildDays(
        [
          { ...scan(0), demoDay: 1 },
          { ...scan(0, [0, 2.5, 0, 0]), ts: T0 + 60_000, demoDay: 2 },
        ],
        { mode: 'demo' },
      ),
    );
    expect(todayKeyOf(T0 + 99_000, true, d).key).toBe('D2');
    const views = buildDayViews(
      d,
      [ev('quickcheck', T0 + 70_000, { skin: 'red', pain: 'ok', care: 'done' }, 'D2')],
      {
        now: T0 + 99_000,
        demo: true,
      },
    );
    expect(views.map((v) => [v.key, v.level])).toEqual([
      ['D1', 'green'],
      ['D2', 'yellow'],
    ]);
  });
});

test('nextSteps never names a medicine or a diagnosis', () => {
  for (const l of ['green', 'yellow', 'orange', 'red', 'none', 'paused'] as const) {
    const s = nextSteps(l, { familyInformed: true });
    expect(s).not.toMatch(/مضاد|دواء|مرهم|تشخيص|التهاب|قرحة/);
  }
});

test('focusSite returns the warmer foot and site', () => {
  const v = buildDayViews(days(scan(0, [0, 0, 0, -2.8])), [], { now: T0 + 1, demo: false })[0]!;
  expect(focusSite(v)).toEqual({ foot: 'L', i: 3 });
});
