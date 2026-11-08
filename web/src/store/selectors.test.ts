import { expect, test } from 'vitest';
import type { Scan } from '@/data/types';
import { buildDays, evaluate } from '@/lib/rules/rules';
import { withDemoDays } from './selectors';

const s = (ts: number, d1: number, extra: Partial<Scan> = {}): Scan => ({
  id: String(ts),
  ts,
  L: [31, 30, 29.5, 30.5],
  R: [31, 30 + d1, 29.5, 30.5],
  standingOk: true,
  stable: true,
  source: 'esp32',
  ...extra,
});

test('ESP32 scans after demo mode was enabled become consecutive demo days', () => {
  const scans = [s(100, 0), s(200, 2.5), s(260, 2.6)];
  const mapped = withDemoDays(scans, 150);
  expect(mapped.map((x) => x.demoDay)).toEqual([undefined, 1, 2]);
  expect(evaluate(buildDays(mapped, { mode: 'demo' })).map((d) => d.level)).toEqual(['yellow', 'orange']);
});

test('explicit demoDay from /sim/ is kept and numbering continues after it', () => {
  const mapped = withDemoDays([s(200, 2.5, { demoDay: 4 }), s(300, 2.6)], 0);
  expect(mapped.map((x) => x.demoDay)).toEqual([4, 5]);
});

test('backfill scans never get a demo day', () => {
  expect(withDemoDays([s(200, 0, { backfill: true })], 0)[0]!.demoDay).toBeUndefined();
});

test('demo mode off = untouched', () => {
  const scans = [s(1, 0)];
  expect(withDemoDays(scans, null)).toBe(scans);
});
