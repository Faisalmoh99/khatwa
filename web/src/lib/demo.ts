import type { Scan } from '@/data/types';

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
