import { describe, expect, test } from 'vitest';
import { EventSchema, LiveSchema, parseCollection, ScanSchema, StatusSchema } from './types';

const good = {
  L: [30.8, 31.2, 30.6, 29.9],
  R: [30.9, 33.8, 30.8, 29.9],
  diff: [0.1, 2.6, 0.2, 0],
  standingOk: true,
  stable: true,
  durationSec: 31,
  faults: [],
  source: 'esp32',
  firmware: '0.1.0',
  ts: 1_762_750_000_000,
};

describe('scan contract (docs/DATA_SCHEMA.md)', () => {
  test('a valid ESP32 scan passes', () => {
    expect(ScanSchema.safeParse(good).success).toBe(true);
  });
  test('R7: missing stable is rejected', () => {
    const { stable: _s, ...noStable } = good;
    expect(ScanSchema.safeParse(noStable).success).toBe(false);
  });
  test('R7: missing standingOk is rejected', () => {
    const { standingOk: _s, ...noStanding } = good;
    expect(ScanSchema.safeParse(noStanding).success).toBe(false);
  });
  test('R7: non-numeric temperature is rejected', () => {
    expect(ScanSchema.safeParse({ ...good, L: [30, '31', 30, 30] }).success).toBe(false);
  });
  test('three sites instead of four is rejected', () => {
    expect(ScanSchema.safeParse({ ...good, R: [30, 31, 30] }).success).toBe(false);
  });
  test('Firebase array-as-object is normalised', () => {
    const r = ScanSchema.safeParse({ ...good, L: { 0: 30.8, 1: 31.2, 2: 30.6, 3: 29.9 } });
    expect(r.success && r.data.L).toEqual([30.8, 31.2, 30.6, 29.9]);
  });
  test('-127 fault value is a valid number in the contract', () => {
    expect(ScanSchema.safeParse({ ...good, L: [-127, 31.2, 30.6, 29.9] }).success).toBe(true);
  });
  test('unknown source is rejected', () => {
    expect(ScanSchema.safeParse({ ...good, source: 'hacker' }).success).toBe(false);
  });
});

describe('other records', () => {
  test('status needs lastSeen', () => {
    expect(StatusSchema.safeParse({ online: true }).success).toBe(false);
    expect(
      StatusSchema.safeParse({ online: true, lastSeen: 1, firmware: '0.1.0', source: 'esp32' }).success,
    ).toBe(true);
  });
  test('live phase must be known', () => {
    expect(LiveSchema.safeParse({ phase: 'settling', L: [0, 0, 0, 0], R: [0, 0, 0, 0] }).success).toBe(true);
    expect(LiveSchema.safeParse({ phase: 'dancing' }).success).toBe(false);
  });
  test('event kind must be known', () => {
    expect(EventSchema.safeParse({ kind: 'quickcheck', data: { skin: 'wound' }, ts: 1 }).success).toBe(true);
    expect(EventSchema.safeParse({ kind: 'drop_table', ts: 1 }).success).toBe(false);
  });
});

describe('parseCollection', () => {
  test('keeps good records sorted by ts, reports bad ones', () => {
    const { items, rejected } = parseCollection(ScanSchema, {
      b: { ...good, ts: 2 },
      a: { ...good, ts: 1 },
      bad: { ...good, stable: undefined },
    });
    expect(items.map((i) => i.id)).toEqual(['a', 'b']);
    expect(rejected.map((r) => r.id)).toEqual(['bad']);
  });
  test('null snapshot = empty', () => {
    expect(parseCollection(ScanSchema, null)).toEqual({ items: [], rejected: [] });
  });
});
