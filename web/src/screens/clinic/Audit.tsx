import { useState } from 'react';
import { EventList } from '@/components/kh/EventList';
import { CLINIC_NAV } from '@/components/layout/navs';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/card';
import type { EventKind } from '@/data/types';
import { cn } from '@/lib/cn';
import { useDevice } from '@/store/device';

const FILTERS: { id: string; label: string; kinds: EventKind[] | null }[] = [
  { id: 'all', label: 'الكل', kinds: null },
  { id: 'esc', label: 'التنبيهات', kinds: ['escalation', 'redflag'] },
  { id: 'reports', label: 'بلاغات المريض', kinds: ['quickcheck', 'question', 'message', 'photo', 'booking'] },
  { id: 'modes', label: 'الأوضاع والإقرار', kinds: ['mode', 'reminder', 'family_ack', 'clinic_ack'] },
];

/** Audit log of the real patient: every alert and escalation, to whom, when (server time) and why. */
export function Audit() {
  const events = useDevice((s) => s.events);
  const [f, setF] = useState('all');
  const kinds = FILTERS.find((x) => x.id === f)!.kinds;
  const list = [...events].reverse().filter((e) => !kinds || kinds.includes(e.kind));

  return (
    <AppShell title="سجل التدقيق" nav={CLINIC_NAV}>
      <p className="text-base text-ink-2">
        كل تنبيه أو تصعيد للمريض الحقيقي: لمين راح، ومتى (بتوقيت الخادم)، وليش.
      </p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="تصفية">
        {FILTERS.map((x) => (
          <button
            key={x.id}
            type="button"
            aria-pressed={f === x.id}
            onClick={() => setF(x.id)}
            className={cn(
              'min-h-touch rounded-full border-2 px-4 text-base font-semibold',
              f === x.id ? 'border-brand-700 bg-brand-700 text-white' : 'border-line bg-surface text-ink-2',
            )}
          >
            {x.label}
          </button>
        ))}
      </div>
      <Card>
        <EventList events={list} empty="ما فيه أحداث بهذا النوع." />
      </Card>
    </AppShell>
  );
}
