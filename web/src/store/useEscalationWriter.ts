import { useEffect, useRef } from 'react';
import { dueEscalations, unwritten } from '@/lib/escalations';
import { realDayKey } from '@/lib/level';
import { serverNow, useDevice, writeEvent } from './device';
import { useDayViews, useLadder } from './selectors';
import { useSettings } from './settings';

/**
 * Writes today's due alerts as `escalation` events (the audit log): who, when (server time), why.
 * Runs only in the patient app, only after the first events snapshot, and never writes a key twice
 * (dedupe against stored events, plus an in-session guard against double renders).
 */
export function useEscalationWriter() {
  const role = useSettings((s) => s.role);
  const consent = useSettings((s) => s.consents.family);
  const source = useDevice((s) => s.source);
  const ready = useDevice((s) => s.eventsLoaded && s.loaded);
  const events = useDevice((s) => s.events);
  const views = useDayViews();
  const ladder = useLadder();
  const written = useRef<{ src: unknown; keys: Set<string> }>({ src: null, keys: new Set() });

  useEffect(() => {
    if (role !== 'patient' || !ready || !source) return;
    if (written.current.src !== source) written.current = { src: source, keys: new Set() };
    const due = dueEscalations(views, ladder, {
      familyConsent: consent,
      realDayKey: realDayKey(serverNow()).key,
    });
    for (const e of unwritten(due, events)) {
      const keys = written.current.keys;
      if (keys.has(e.key)) continue;
      keys.add(e.key);
      const data: Record<string, unknown> = {
        key: e.key,
        to: e.to,
        level: e.level,
        reason: e.reason,
        why: e.why,
      };
      if (e.urgent) data.urgent = true;
      void writeEvent({ kind: 'escalation', day: e.day, data }).catch(() => keys.delete(e.key));
    }
  }, [role, ready, source, views, ladder, events, consent]);
}
