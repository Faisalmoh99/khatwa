import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { buildDays, checkScan, evaluate } from '@/lib/rules/rules';
import { SimulationSource } from './SimulationSource';
import type { Live, Scan } from './types';

function run(scenario: string, opts: { demoDay?: number } = {}) {
  const src = new SimulationSource('test', { tickMs: 10, storage: null, random: () => 0.5 });
  const phases: Live['phase'][] = [];
  let scans: Scan[] = [];
  void src.start();
  src.subscribeLive((l) => l && phases.push(l.phase));
  src.subscribeScans((s) => (scans = s));
  src.startScan(scenario, opts);
  vi.advanceTimersByTime(10 * 100);
  return { src, phases, scans };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('SimulationSource live scan', () => {
  test('normal: placing → settling → done, writes one valid green scan', () => {
    const { phases, scans } = run('normal');
    expect(phases).toContain('placing');
    expect(phases).toContain('settling');
    expect(phases).toContain('done');
    expect(scans).toHaveLength(1);
    expect(scans[0]!.source).toBe('sim');
    expect(scans[0]!.stable).toBe(true);
    expect(evaluate(buildDays(scans))[0]!.level).toBe('green');
  });

  test('hot: flagged at MTH1 on the right', () => {
    const { scans } = run('hot');
    const c = checkScan(scans[0]!);
    expect(c.ok).toBe(true);
    expect(c.flagged).toEqual([1]);
    expect(c.diff[1]!).toBeGreaterThan(2.2);
  });

  test('one foot: error phase and no scan (same as the ESP32)', () => {
    const { phases, scans } = run('one');
    expect(phases).toContain('error');
    expect(scans).toHaveLength(0);
  });

  test('fault: -127 on L2 and the scan is still usable', () => {
    const { scans } = run('fault');
    expect((scans[0]!.L as number[])[2]).toBe(-127);
    expect(scans[0]!.faults).toEqual(['L2']);
    expect(checkScan(scans[0]!).ok).toBe(true);
  });

  test('allsites: scan written but rejected by the rule', () => {
    const { scans } = run('allsites');
    expect(checkScan(scans[0]!).issues.map((i) => i.code)).toContain('allsites');
  });

  test('demo mode: two hot scans with demoDay 1 and 2 = orange', () => {
    const src = new SimulationSource('test', { tickMs: 10, storage: null, random: () => 0.5 });
    let scans: Scan[] = [];
    void src.start();
    src.subscribeScans((s) => (scans = s));
    src.startScan('hot', { demoDay: 1 });
    vi.advanceTimersByTime(1000);
    src.startScan('hot', { demoDay: 2 });
    vi.advanceTimersByTime(1000);
    const r = evaluate(buildDays(scans, { mode: 'demo' }));
    expect(r.map((d) => d.level)).toEqual(['yellow', 'orange']);
  });

  test('step off: no scan', () => {
    const src = new SimulationSource('test', { tickMs: 10, storage: null });
    let scans: Scan[] = [];
    void src.start();
    src.subscribeScans((s) => (scans = s));
    src.startScan('normal');
    vi.advanceTimersByTime(40);
    src.stepOff();
    vi.advanceTimersByTime(1000);
    expect(scans).toHaveLength(0);
  });
});

describe('SimulationSource history and events', () => {
  test('30-day developing scenario reaches orange and every scan is marked backfill', () => {
    vi.setSystemTime(Date.UTC(2026, 10, 8, 12));
    const src = new SimulationSource('test', { storage: null });
    let scans: Scan[] = [];
    void src.start();
    src.subscribeScans((s) => (scans = s));
    src.loadDays('developing');
    expect(scans.length).toBe(30);
    expect(scans.every((s) => s.backfill && s.scenario === 'developing')).toBe(true);
    expect(evaluate(buildDays(scans)).some((d) => d.level === 'orange')).toBe(true);
  });

  test('dropoff scenario has 15 days', () => {
    vi.setSystemTime(Date.UTC(2026, 10, 8, 12));
    const src = new SimulationSource('test', { storage: null });
    let scans: Scan[] = [];
    void src.start();
    src.subscribeScans((s) => (scans = s));
    src.loadDays('dropoff');
    expect(scans.length).toBe(15);
  });

  test('writeEvent is delivered with a timestamp and id', async () => {
    const src = new SimulationSource('test', { storage: null });
    const seen: unknown[] = [];
    await src.start();
    src.subscribeEvents((e) => seen.push(e));
    await src.writeEvent({ kind: 'quickcheck', data: { skin: 'wound' }, day: '2026-11-08' });
    const last = seen.at(-1) as { kind: string; ts: number; id: string }[];
    expect(last).toHaveLength(1);
    expect(last[0]!.kind).toBe('quickcheck');
    expect(typeof last[0]!.ts).toBe('number');
    expect(last[0]!.id).toBeTruthy();
  });

  test('heartbeat off = offline', async () => {
    const src = new SimulationSource('test', { storage: null });
    let online = true;
    await src.start();
    src.subscribeStatus((_s, o) => (online = o));
    src.setHeartbeat(false);
    expect(online).toBe(false);
  });
});
