import type { DayView } from '@/lib/level';
import { cn } from '@/lib/cn';
import { LEVEL } from './levels';

const WEEKDAY = new Intl.DateTimeFormat('ar-SA-u-ca-gregory', { weekday: 'short', timeZone: 'UTC' });

/** Last N days as coloured dots (real calendar) or demo days. */
export function DayStrip({
  views,
  count = 7,
  demo = false,
}: {
  views: DayView[];
  count?: number;
  demo?: boolean;
}) {
  const last = views.slice(-count);
  return (
    <ol
      className="grid gap-1"
      style={{ gridTemplateColumns: `repeat(${count}, minmax(0,1fr))` }}
      aria-label="آخر الأيام"
    >
      {Array.from({ length: count }, (_, k) => {
        const v = last[k - (count - last.length)];
        if (!v) return <li key={k} />;
        const m = LEVEL[v.level];
        const label =
          demo || v.key.startsWith('D')
            ? `يوم ${v.key.slice(1)}`
            : WEEKDAY.format(new Date(v.key + 'T12:00:00Z'));
        const today = k === count - 1;
        return (
          <li key={v.key} className="grid justify-items-center gap-1" aria-label={`${label}: ${m.ar}`}>
            <span
              className={cn(
                'grid size-9 place-items-center rounded-full border-2 text-xs font-semibold',
                today && 'ring-2 ring-brand-500 ring-offset-2',
              )}
              style={{
                background: v.level === 'none' ? 'transparent' : m.fill,
                borderColor: v.level === 'none' ? 'var(--kh-line-strong)' : m.fill,
                color: '#fff',
              }}
            >
              {v.done ? '' : v.level === 'paused' ? '‖' : ''}
            </span>
            <span className={cn('truncate text-xs', today ? 'font-semibold text-ink' : 'text-mute')}>
              {today ? 'اليوم' : label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
