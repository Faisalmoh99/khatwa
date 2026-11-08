import { describe as group, expect, test } from 'vitest';
import {
  baseline,
  buildDays,
  checkScan,
  daysSinceLastValid,
  describe,
  evaluate,
  POLICY,
  THRESH,
  type ScanInput,
} from './rules';

const DAY = 86_400_000;
const T0 = Date.UTC(2026, 10, 10, 5, 0, 0); // 10 Nov 08:00 Riyadh time
const base = [31.0, 30.0, 29.5, 30.5];
const scan = (dayN: number, Rdelta = [0, 0, 0, 0], extra: Partial<ScanInput> = {}): ScanInput => ({
  ts: T0 + dayN * DAY,
  L: base.slice(),
  R: base.map((v, i) => +(v + (Rdelta[i] ?? 0)).toFixed(2)),
  standingOk: true,
  stable: true,
  ...extra,
});

/* ---------- The 13 original tests from tests/rules.test.js (unchanged meaning) ---------- */
group('original 13', () => {
  test('normal reading = green', () => {
    const r = evaluate(buildDays([scan(0, [0.3, -0.2, 0.1, 0])]));
    expect(r[0]!.status).toBe('normal');
    expect(r[0]!.level).toBe('green');
  });

  test('exactly 2.2 does not flag (greater than, not equal)', () => {
    const r = evaluate(buildDays([scan(0, [0, THRESH, 0, 0])]));
    expect(r[0]!.status).toBe('normal');
  });

  test('one day above = yellow, two consecutive days same site = orange', () => {
    const r = evaluate(buildDays([scan(0, [0, 2.5, 0, 0]), scan(1, [0, 2.6, 0, 0])]));
    expect(r[0]!.status).toBe('watch');
    expect(r[1]!.status).toBe('alert');
    expect(r[1]!.level).toBe('orange');
    expect(r[1]!.alertSites).toEqual([1]);
  });

  test('a missing day in between breaks the streak', () => {
    const r = evaluate(buildDays([scan(0, [0, 2.5, 0, 0]), scan(2, [0, 2.6, 0, 0])]));
    expect(r[1]!.status).toBe('watch');
  });

  test('warmer foot switched = no alert', () => {
    const r = evaluate(buildDays([scan(0, [0, 2.5, 0, 0]), scan(1, [0, -2.5, 0, 0])]));
    expect(r[1]!.status).toBe('watch');
  });

  test('two different sites = no alert', () => {
    const r = evaluate(buildDays([scan(0, [0, 2.5, 0, 0]), scan(1, [0, 0, 2.5, 0])]));
    expect(r[1]!.status).toBe('watch');
  });

  test('big difference at every site = posture error, rejected', () => {
    const c = checkScan(scan(0, [3, 3, 3, 3]));
    expect(c.ok).toBe(false);
    expect(c.issues.some((x) => x.code === 'allsites')).toBe(true);
  });

  test('faulty sensor (-127) excludes its site and keeps the others', () => {
    const s = scan(0, [0, 2.5, 0, 0]);
    (s.L as number[])[0] = -127;
    const c = checkScan(s);
    expect(c.ok).toBe(true);
    expect(c.diff[0]).toBeNull();
    expect(c.faults).toEqual(['L0']);
    expect(c.flagged).toEqual([1]);
  });

  test('implausible temperature (wet foot) = rejected', () => {
    const s = scan(0);
    (s.L as number[])[2] = 18.4;
    expect(checkScan(s).ok).toBe(false);
  });

  test('wrong standing = rejected, and a rejected day breaks the streak', () => {
    const r = evaluate(
      buildDays([
        scan(0, [0, 2.5, 0, 0]),
        scan(1, [0, 2.5, 0, 0], { standingOk: false }),
        scan(2, [0, 2.5, 0, 0]),
      ]),
    );
    expect(r[1]!.status).toBe('invalid');
    expect(r[2]!.status).toBe('watch');
  });

  test('several readings in one day: take the last valid one', () => {
    const a = scan(0, [0, 2.5, 0, 0]);
    const b = { ...scan(0), ts: Number(a.ts) + 60_000 };
    const days = buildDays([a, b]);
    expect(days.length).toBe(1);
    expect(days[0]!.attempts).toBe(2);
    expect(evaluate(days)[0]!.status).toBe('normal');
  });

  test('demo mode: each demoDay is its own day even in the same minute', () => {
    const a = { ...scan(0, [0, 2.5, 0, 0]), demoDay: 1 };
    const b = { ...scan(0, [0, 2.6, 0, 0]), ts: Number(a.ts) + 30_000, demoDay: 2 };
    const r = evaluate(buildDays([a, b], { mode: 'demo' }));
    expect(r[1]!.status).toBe('alert');
  });

  test('Firebase returns the array as an object', () => {
    const s = scan(0, [0, 2.5, 0, 0]);
    const L = s.L as number[];
    s.L = { 0: L[0], 1: L[1], 2: L[2], 3: L[3] };
    expect(checkScan(s).ok).toBe(true);
  });
});

/* ---------- Review finding R10: missing cases ---------- */
group('R10 additional cases', () => {
  test('allsites: three usable sites all hot in the same direction is still rejected', () => {
    const s = scan(0, [3, 3, 3, 0]);
    (s.R as number[])[3] = -127; // one fault, three usable sites left
    const c = checkScan(s);
    expect(c.ok).toBe(false);
    expect(c.issues.map((x) => x.code)).toContain('allsites');
  });

  test('allsites: mixed directions is not a posture error', () => {
    const c = checkScan(scan(0, [3, -3, 3, -3]));
    expect(c.issues.map((x) => x.code)).not.toContain('allsites');
    expect(c.ok).toBe(true);
  });

  test('several readings in one day: an invalid later reading does not replace an earlier valid one', () => {
    const a = scan(0, [0, 2.5, 0, 0]);
    const b = { ...scan(0, [0, 0, 0, 0], { standingOk: false }), ts: Number(a.ts) + 60_000 };
    const days = buildDays([a, b]);
    expect(days[0]!.valid).toBe(true);
    expect(days[0]!.attempts).toBe(2);
    expect(evaluate(days)[0]!.status).toBe('watch');
  });

  test('several readings in one day, all invalid: day is invalid and shows the last attempt', () => {
    const a = scan(0, [0, 0, 0, 0], { stable: false });
    const b = { ...scan(0, [0, 0, 0, 0], { standingOk: false }), ts: Number(a.ts) + 60_000 };
    const d = buildDays([a, b]);
    expect(d[0]!.valid).toBe(false);
    expect(d[0]!.check.issues.map((x) => x.code)).toContain('standing');
  });

  test('stable:false is rejected', () => {
    expect(checkScan(scan(0, [0, 0, 0, 0], { stable: false })).ok).toBe(false);
  });

  test('missing stable field: rules engine accepts it (the zod schema rejects it, see types.test.ts)', () => {
    const s = scan(0);
    delete s.stable;
    expect(checkScan(s).ok).toBe(true);
  });

  test('85°C (DS18B20 power-on value) is a sensor fault, not a temperature', () => {
    const s = scan(0, [0, 2.5, 0, 0]);
    (s.R as number[])[2] = 85;
    const c = checkScan(s);
    expect(c.faults).toEqual(['R2']);
    expect(c.diff[2]).toBeNull();
    expect(c.ok).toBe(true);
  });

  test('wrong array length = shape error', () => {
    const c = checkScan({ ts: T0, L: [30, 30, 30], R: [30, 30, 30, 30] });
    expect(c.ok).toBe(false);
    expect(c.issues[0]!.code).toBe('shape');
  });

  test('every sensor faulty = not ok (nothing to compare)', () => {
    const c = checkScan({ ts: T0, L: [-127, -127, -127, -127], R: [-127, -127, -127, -127], stable: true });
    expect(c.ok).toBe(false);
  });

  test('midnight in Riyadh: 23:59 and 00:01 Riyadh time are two consecutive days', () => {
    const late = Date.UTC(2026, 10, 10, 20, 59); // 23:59 Riyadh on 10 Nov
    const early = Date.UTC(2026, 10, 10, 21, 1); // 00:01 Riyadh on 11 Nov
    const days = buildDays([scan(0, [0, 2.5, 0, 0], { ts: late }), scan(0, [0, 2.6, 0, 0], { ts: early })]);
    expect(days.map((d) => d.key)).toEqual(['2026-11-10', '2026-11-11']);
    expect(evaluate(days)[1]!.status).toBe('alert');
  });

  test('midnight in Riyadh: 20:59 UTC and 21:01 UTC are different days even though UTC date is the same', () => {
    const a = Date.UTC(2026, 10, 10, 20, 59);
    const b = Date.UTC(2026, 10, 10, 21, 1);
    expect(new Date(a).getUTCDate()).toBe(new Date(b).getUTCDate());
    expect(buildDays([scan(0, [0, 0, 0, 0], { ts: a }), scan(0, [0, 0, 0, 0], { ts: b })]).length).toBe(2);
  });

  test('daysSinceLastValid counts in Riyadh days', () => {
    const days = buildDays([scan(0)]);
    expect(daysSinceLastValid(days, T0)).toBe(0);
    expect(daysSinceLastValid(days, T0 + DAY)).toBe(1);
    expect(daysSinceLastValid(days, T0 + 3 * DAY)).toBe(3);
    expect(daysSinceLastValid([], T0)).toBeNull();
  });

  test('baseline: mean of the first 7 valid days, per site', () => {
    const days = buildDays([0, 1, 2, 3, 4, 5, 6, 7].map((d) => scan(d, [0.2, d === 7 ? 3 : 0, 0, 0])));
    const b = baseline(days)!;
    expect(b[0]).toEqual({ mean: 0.2, n: 7 });
    expect(b[1]).toEqual({ mean: 0, n: 7 }); // day 8 is outside the window
  });

  test('describe uses the correct Arabic dual', () => {
    const r = evaluate(buildDays([scan(0, [0, 2.5, 0, 0]), scan(1, [0, 2.6, 0, 0])]));
    expect(describe(r[1])).toContain('ليومين متتاليين');
    expect(describe(r[1])).not.toContain('2 أيام');
    expect(describe(r[0])).toContain('اليوم فقط');
  });
});

/* ---------- R2 / R5: waiting for Nouran. Defaults must not change until she answers. ---------- */
group('policy waiting for clinical review', () => {
  test('defaults reproduce the prototype', () => {
    expect(POLICY).toEqual({ allSitesHot: 'reject', dayPick: 'lastValid' });
  });
  test.todo('R2: whole-foot warming handled per Nouran (e.g. accept as alert-eligible or flag for review)');
  test.todo('R5: day representative per Nouran (e.g. hottest valid scan of the day instead of last)');
});

/* ---------- Parity with app/js/rules.js (review finding R3) ---------- */
group('parity with app/js/rules.js', async () => {
  const legacyPath = new URL('../../../../app/js/rules.js', import.meta.url).href;
  type Legacy = {
    checkScan: typeof checkScan;
    buildDays: typeof buildDays;
    evaluate: typeof evaluate;
    baseline: typeof baseline;
    daysSinceLastValid: typeof daysSinceLastValid;
  };
  const legacy = (await import(/* @vite-ignore */ legacyPath)) as Legacy;

  const cases: Record<string, ScanInput[]> = {
    normal: [scan(0, [0.3, -0.2, 0.1, 0])],
    twoDays: [scan(0, [0, 2.5, 0, 0]), scan(1, [0, 2.6, 0, 0])],
    gap: [scan(0, [0, 2.5, 0, 0]), scan(2, [0, 2.6, 0, 0])],
    flip: [scan(0, [0, 2.5, 0, 0]), scan(1, [0, -2.5, 0, 0])],
    allsites: [scan(0, [3, 3, 3, 3])],
    fault: [scan(0, [0, 2.5, 0, 0], { L: [-127, 30, 29.5, 30.5] })],
    wet: [scan(0, [0, 0, 0, 0], { L: [31, 30, 18.4, 30.5] })],
    invalidMiddle: [
      scan(0, [0, 2.5, 0, 0]),
      scan(1, [0, 2.5, 0, 0], { standingOk: false }),
      scan(2, [0, 2.5, 0, 0]),
    ],
    threeDays: [scan(0, [0, 0, 2.7, 0]), scan(1, [0, 0, 2.8, 0]), scan(2, [0, 0, 2.9, 0])],
    sameDay: [scan(0, [0, 2.5, 0, 0]), { ...scan(0), ts: T0 + 60_000 }],
    eightyFive: [scan(0, [0, 2.5, 0, 0], { R: [31, 32.5, 85, 30.5] })],
  };

  for (const [name, list] of Object.entries(cases)) {
    test(`same result: ${name}`, () => {
      const a = evaluate(buildDays(structuredClone(list)));
      const b = legacy.evaluate(legacy.buildDays(structuredClone(list)));
      expect(a).toEqual(b);
      expect(baseline(buildDays(structuredClone(list)))).toEqual(
        legacy.baseline(legacy.buildDays(structuredClone(list))),
      );
      expect(daysSinceLastValid(buildDays(structuredClone(list)), T0 + 5 * DAY)).toBe(
        legacy.daysSinceLastValid(legacy.buildDays(structuredClone(list)), T0 + 5 * DAY),
      );
    });
  }

  test('same result in demo mode', () => {
    const list = [
      { ...scan(0, [0, 2.5, 0, 0]), demoDay: 1 },
      { ...scan(0, [0, 2.6, 0, 0]), ts: T0 + 30_000, demoDay: 2 },
    ];
    expect(evaluate(buildDays(structuredClone(list), { mode: 'demo' }))).toEqual(
      legacy.evaluate(legacy.buildDays(structuredClone(list), { mode: 'demo' })),
    );
  });
});
