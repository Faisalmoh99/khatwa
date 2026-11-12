import { describe, expect, test } from 'vitest';
import { parseSerialLine } from './SerialSource';
import { StabilityTracker } from './stability';

const L = [30.8, 31.2, 30.6, 29.9];
const R = [30.9, 31.0, 30.7, 30.1];

describe('StabilityTracker (USB readings)', () => {
  test('idle until both heels are pressed', () => {
    const t = new StabilityTracker();
    expect(t.push({ t: 0, L, R, fsrL: 100, fsrR: 100 }).live.phase).toBe('idle');
  });

  test('steady readings finish after at least 8 s with a stable scan', () => {
    const t = new StabilityTracker();
    let scan;
    for (let s = 0; s <= 12 && !scan; s++) scan = t.push({ t: s, L, R, fsrL: 2600, fsrR: 2600 }).scan;
    expect(scan).toBeDefined();
    expect(scan!.stable).toBe(true);
    expect(scan!.durationSec).toBeGreaterThanOrEqual(8);
    expect(scan!.diff).toEqual([0.1, -0.2, 0.1, 0.2]);
  });

  test('rising readings do not finish early', () => {
    const t = new StabilityTracker();
    let scan;
    for (let s = 0; s <= 20 && !scan; s++)
      scan = t.push({ t: s, L: L.map((v) => v + s * 0.2), R, fsrL: 2600, fsrR: 2600 }).scan;
    expect(scan).toBeUndefined();
  });

  test('stepping off mid-way = error and no scan', () => {
    const t = new StabilityTracker();
    t.push({ t: 0, L, R, fsrL: 2600, fsrR: 2600 });
    const r = t.push({ t: 3, L, R, fsrL: 2600, fsrR: 200 });
    expect(r.live.phase).toBe('error');
    expect(r.scan).toBeUndefined();
  });

  test('times out at 90 s with stable:false', () => {
    const t = new StabilityTracker();
    let scan;
    for (let s = 0; s <= 95 && !scan; s++)
      scan = t.push({ t: s, L: L.map((v) => v + (s % 2) * 0.3), R, fsrL: 2600, fsrR: 2600 }).scan;
    expect(scan!.stable).toBe(false);
  });

  test('a faulty sensor (-127) is reported and does not block stability', () => {
    const t = new StabilityTracker();
    let scan;
    for (let s = 0; s <= 12 && !scan; s++)
      scan = t.push({ t: s, L: [30.8, 31.2, -127, 29.9], R, fsrL: 2600, fsrR: 2600 }).scan;
    expect(scan!.faults).toEqual(['L2']);
    expect(scan!.diff![2]).toBe(-127);
  });
});

describe('parseSerialLine', () => {
  test('valid line', () => {
    expect(parseSerialLine('{"L":[30,31,30,29],"R":[30,31,30,29],"fsrL":2600,"fsrR":2500}\r')).toMatchObject({
      fsrL: 2600,
    });
  });
  test('debug prints, broken JSON and wrong shape are ignored', () => {
    expect(parseSerialLine('WiFi connected')).toBeNull();
    expect(parseSerialLine('{"L":[30,31')).toBeNull();
    expect(parseSerialLine('{"L":[30,31,30],"R":[30,31,30,29]}')).toBeNull();
    expect(parseSerialLine('')).toBeNull();
  });
});
