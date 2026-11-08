import { expect, test } from 'vitest';
import { labTimeline, runCohort } from './ruleLab';
import { DAY_MS, type ScanInput } from './rules/rules';

const s = (d: number, dR: number[]): ScanInput => ({
  ts: d * DAY_MS + 5 * 3_600_000,
  L: [31, 30, 29.5, 30.5],
  R: [31, 30, 29.5, 30.5].map((v, i) => +(v + dR[i]!).toFixed(2)),
  standingOk: true,
  stable: true,
});

test('rule A in the lab is the real engine: two consecutive days, same foot', () => {
  const tl = labTimeline([s(1, [0, 2.5, 0, 0]), s(2, [0, 2.6, 0, 0]), s(3, [0, -2.6, 0, 0])], 'two');
  expect(tl).toEqual([[], [1], []]);
});

test('rule B allows one missing day between two hot days', () => {
  const scans = [s(1, [0, 2.5, 0, 0]), null, s(3, [0, 2.6, 0, 0])];
  expect(labTimeline(scans, 'window')).toEqual([[], null, [1]]);
  expect(labTimeline(scans, 'two')).toEqual([[], null, []]);
});

test('single-day rule alerts on the first hot day; 2.2 exactly is not hot', () => {
  expect(labTimeline([s(1, [0, 2.3, 0, 0]), s(2, [2.2, 0, 0, 0])], 'single')).toEqual([[1], []]);
});

test('cohort is deterministic and the 2-day rules cut false alarms vs the 1-day rule', () => {
  const a = runCohort({ n: 120, seed: 7 });
  const b = runCohort({ n: 120, seed: 7 });
  expect(a).toEqual(b);
  const get = (k: string) => a.find((r) => r.key === k)!;
  expect(get('two').falsePer100).toBeLessThan(get('single').falsePer100);
  expect(get('twoProto').falsePer100).toBeLessThanOrEqual(get('two').falsePer100);
  expect(get('single').sensitivity).toBeGreaterThan(0.5);
});
