import { describe, expect, it } from 'vitest';
import { realDayKey } from '../../lib/level';
import { DAYS_SCENARIOS, generateDays } from './scenarios';

const developing = DAYS_SCENARIOS.find((s) => s.id === 'developing')!;

describe('generateDays: 30 Riyadh days ending today, at any hour', () => {
  // 00:15 UTC = 03:15 Riyadh (before the 08:00 slot); 22:00 UTC = 01:00 Riyadh of the next UTC day; plus midday.
  it.each(['2026-11-14T00:15:00Z', '2026-11-13T22:00:00Z', '2026-11-14T21:00:30Z', '2026-11-14T12:00:00Z'])(
    'at %s the last scan is today (Riyadh), none is in the future, one scan per day',
    (iso) => {
      const now = Date.parse(iso);
      const scans = generateDays(developing, now);
      expect(scans).toHaveLength(30);
      expect(scans.every((s) => s.ts <= now)).toBe(true);
      expect(realDayKey(scans.at(-1)!.ts).key).toBe(realDayKey(now).key);
      const keys = scans.map((s) => realDayKey(s.ts).idx);
      expect(new Set(keys).size).toBe(30);
      expect(keys.at(-1)! - keys[0]!).toBe(29);
    },
  );
});
