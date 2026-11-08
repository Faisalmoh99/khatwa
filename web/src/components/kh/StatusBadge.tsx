import { cn } from '@/lib/cn';
import { LEVEL, type Level } from './levels';

/** Level pill. Colour is never the only signal: the Arabic word is always shown. */
export function StatusBadge({
  level,
  label,
  className,
  size = 'md',
}: {
  level: Level;
  label?: string;
  className?: string;
  size?: 'md' | 'lg';
}) {
  const m = LEVEL[level];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 rounded-full font-semibold',
        size === 'lg' ? 'px-4 py-1.5 text-lg' : 'px-3 py-1 text-sm',
        className,
      )}
      style={{ background: m.soft, color: m.ink }}
    >
      <span aria-hidden className="size-2.5 rounded-full" style={{ background: m.fill }} />
      {label ?? m.ar}
    </span>
  );
}
