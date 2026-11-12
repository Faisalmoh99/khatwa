import { ArrowLeft } from 'lucide-react';
import type { KhEvent } from '@/data/types';
import { cn } from '@/lib/cn';
import { eventLine } from '@/lib/eventText';
import { arDate, clock } from '@/lib/format';

const TONE = { urgent: 'border-s-lv-red', warn: 'border-s-lv-orange', info: 'border-s-brand-300' } as const;

/** Audit-style list: what, to whom, when (server time), why. All text, never HTML. */
export function EventList({ events, empty = 'ما فيه أحداث.' }: { events: KhEvent[]; empty?: string }) {
  if (!events.length) return <p className="py-4 text-center text-base text-mute">{empty}</p>;
  return (
    <ol className="grid gap-2" data-testid="event-list">
      {events.map((e) => {
        const l = eventLine(e);
        return (
          <li
            key={e.id}
            className={cn('rounded-sm border border-line border-s-4 bg-surface p-3', TONE[l.tone])}
            data-kind={e.kind}
          >
            <div className="flex flex-wrap items-baseline justify-between gap-x-3">
              <p className="text-base font-semibold text-ink">{l.title}</p>
              <p className="text-sm text-mute">
                {arDate(e.ts)} · <span className="num">{clock(e.ts)}</span>
              </p>
            </div>
            {l.to !== '—' && (
              <p className="flex items-center gap-1 text-sm text-ink-2">
                <ArrowLeft className="size-4 rotate-180" aria-hidden /> إلى: {l.to}
              </p>
            )}
            {l.why && <p className="text-sm text-ink-2">{l.why}</p>}
          </li>
        );
      })}
    </ol>
  );
}
