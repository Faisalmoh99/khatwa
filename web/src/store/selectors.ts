import { useMemo } from 'react';
import { withDemoDays } from '@/lib/demo';
import { useNow } from '@/hooks/useNow';
import { ladderState } from '@/lib/ladder';
import { buildDayViews, type DayView } from '@/lib/level';
import { buildDays, evaluate, type EvaluatedDay } from '@/lib/rules/rules';
import { serverNow, useDevice } from './device';
import { useSettings } from './settings';

export { withDemoDays };

/** Evaluated thermal days from the real scans. Demo mode = each scan counts as one day. */
export function useDays(): EvaluatedDay[] {
  const scans = useDevice((s) => s.scans);
  const demo = useSettings((s) => s.demoMode);
  const since = useSettings((s) => s.demoSince);
  return useMemo(
    () => evaluate(buildDays(demo ? withDemoDays(scans, since) : scans, { mode: demo ? 'demo' : 'real' })),
    [scans, demo, since],
  );
}

/** Real-calendar days (ignores demo mode). Used by the adherence ladder. */
export function useRealDays(): EvaluatedDay[] {
  const scans = useDevice((s) => s.scans);
  return useMemo(() => evaluate(buildDays(scans)), [scans]);
}

/** One view per day (thermal + reports + pause), including today. Refreshes every minute. */
export function useDayViews(): DayView[] {
  const days = useDays();
  const events = useDevice((s) => s.events);
  const demo = useSettings((s) => s.demoMode);
  const tick = useNow(60_000);
  return useMemo(() => {
    void tick;
    return buildDayViews(days, events, { now: serverNow(), demo });
  }, [days, events, demo, tick]);
}

/** Today's view (always exists). */
export function useToday(): DayView {
  const views = useDayViews();
  return views.at(-1)!;
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

/** Adherence ladder from real-calendar days (demo mode does not affect it). */
export function useLadder() {
  const days = useRealDays();
  const events = useDevice((s) => s.events);
  const reminder = useSettings((s) => s.reminderTime);
  const tick = useNow(60_000);
  return useMemo(() => {
    void tick;
    const now = serverNow();
    const views = buildDayViews(days, events, { now, demo: false });
    return { ...ladderState(views, events, now, reminder), views };
  }, [days, events, reminder, tick]);
}
