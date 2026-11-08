import { useMemo } from 'react';
import type { Scan } from '@/data/types';
import { buildDays, evaluate, type EvaluatedDay } from '@/lib/rules/rules';
import { useDevice } from './device';
import { useSettings } from './settings';

/**
 * Demo mode input mapping (does not touch the rule engine):
 * the real ESP32 never writes demoDay, so scans taken after demo mode was switched on
 * get consecutive demo days, continuing after the highest explicit demoDay (e.g. from /sim/).
 */
export function withDemoDays(scans: Scan[], demoSince: number | null): Scan[] {
  if (demoSince === null) return scans;
  let next = scans.reduce((m, s) => (Number.isInteger(s.demoDay) ? Math.max(m, s.demoDay!) : m), 0) + 1;
  return [...scans]
    .sort((a, b) => a.ts - b.ts)
    .map((s) =>
      Number.isInteger(s.demoDay) || s.ts < demoSince || s.backfill ? s : { ...s, demoDay: next++ },
    );
}

/** Evaluated days from the real scans. Demo mode = each scan counts as one day. */
export function useDays(): EvaluatedDay[] {
  const scans = useDevice((s) => s.scans);
  const demo = useSettings((s) => s.demoMode);
  const since = useSettings((s) => s.demoSince);
  return useMemo(
    () => evaluate(buildDays(demo ? withDemoDays(scans, since) : scans, { mode: demo ? 'demo' : 'real' })),
    [scans, demo, since],
  );
}

/** Next demo day number for the in-browser simulator (max existing + 1). */
export function useNextDemoDay(): number {
  const scans = useDevice((s) => s.scans);
  const since = useSettings((s) => s.demoSince);
  return useMemo(() => {
    const mapped = withDemoDays(scans, since);
    return mapped.reduce((m, s) => (Number.isInteger(s.demoDay) ? Math.max(m, s.demoDay!) : m), 0) + 1;
  }, [scans, since]);
}
