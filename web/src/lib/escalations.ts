/**
 * Which alerts are due today, and to whom (the audit log). Pure.
 * The patient app writes each one once as an `escalation` event (dedupe by `key`).
 *
 *   yellow → patient · orange → patient + family (first day of the episode)
 *   orange for 3+ days → clinic · red → patient + family + clinic (urgent)
 *   1 day missed → patient reminder · 2 days → family · 3 days (then every 3) → clinic
 * Family alerts only with the family consent. Pause modes stop everything except red.
 */
import type { KhEvent } from '@/data/types';
import type { LadderState } from './ladder';
import type { DayView } from './level';

export type Recipient = 'patient' | 'family' | 'clinic';
export type EscReason = 'watch' | 'thermal' | 'thermal_persist' | 'red' | 'reminder' | 'adherence';

export interface Escalation {
  key: string;
  to: Recipient;
  level: 1 | 3 | 4;
  reason: EscReason;
  why: string;
  urgent?: boolean;
  day: string;
}

export const RECIPIENT_AR: Record<Recipient, string> = {
  patient: 'المريض',
  family: 'العائلة',
  clinic: 'العيادة',
};
export const REASON_AR: Record<EscReason, string> = {
  watch: 'مستوى أصفر',
  thermal: 'مستوى برتقالي',
  thermal_persist: 'برتقالي مستمر',
  red: 'مستوى أحمر',
  reminder: 'تذكير بالقياس',
  adherence: 'أيام بدون قياس',
};

const plain = (s: string) => s.replace(/[⁦-⁩]/g, '');

export function dueEscalations(
  views: DayView[],
  ladder: Pick<LadderState, 'step' | 'missed' | 'paused' | 'todayDone'>,
  { familyConsent, realDayKey }: { familyConsent: boolean; realDayKey: string },
): Escalation[] {
  const out: Escalation[] = [];
  const today = views.at(-1);
  const add = (e: Omit<Escalation, 'key'>) => out.push({ ...e, key: `${e.day}|${e.reason}|${e.to}` });

  if (today) {
    const why = plain(today.reasons.map((r) => r.ar).join('، '));
    const day = today.key;
    if (today.level === 'red') {
      add({ to: 'patient', level: 1, reason: 'red', why, day });
      if (familyConsent) add({ to: 'family', level: 3, reason: 'red', why, day, urgent: true });
      add({ to: 'clinic', level: 4, reason: 'red', why, day, urgent: true });
    } else if (!ladder.paused && today.level === 'orange') {
      add({ to: 'patient', level: 1, reason: 'thermal', why, day });
      let run = 0;
      for (let i = views.length - 1; i >= 0 && views[i]!.level === 'orange'; i--) run++;
      const prev = views.at(-2);
      if (familyConsent && prev?.level !== 'orange' && prev?.level !== 'red')
        add({ to: 'family', level: 3, reason: 'thermal', why, day });
      if (run >= 3)
        add({ to: 'clinic', level: 4, reason: 'thermal_persist', why: `${why} (منذ ${run} أيام)`, day });
    } else if (!ladder.paused && today.level === 'yellow') {
      add({ to: 'patient', level: 1, reason: 'watch', why, day });
    }
  }

  if (!ladder.paused && !ladder.todayDone && ladder.missed > 0) {
    const day = realDayKey;
    const why =
      ladder.missed === 1
        ? 'يوم بدون قياس'
        : ladder.missed === 2
          ? 'يومين بدون قياس'
          : `${ladder.missed} أيام بدون قياس`;
    if (ladder.step === 2) add({ to: 'patient', level: 1, reason: 'reminder', why, day });
    if (ladder.step === 3 && familyConsent) add({ to: 'family', level: 3, reason: 'adherence', why, day });
    if (ladder.step === 4 && ladder.missed % 3 === 0)
      add({ to: 'clinic', level: 4, reason: 'adherence', why, day });
  }
  return out;
}

/** Escalations not yet written (by key). */
export function unwritten(due: Escalation[], events: KhEvent[]): Escalation[] {
  const done = new Set(
    events.filter((e) => e.kind === 'escalation').map((e) => String((e.data as { key?: unknown })?.key)),
  );
  return due.filter((e) => !done.has(e.key));
}
