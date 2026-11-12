import { CheckCircle2, CircleAlert, CirclePause, CircleHelp, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import type { FinalLevel } from '@/lib/level';
import { cn } from '@/lib/cn';
import { LEVEL } from './levels';

const ICON: Record<FinalLevel, ReactNode> = {
  green: <CheckCircle2 />,
  yellow: <CircleAlert />,
  orange: <TriangleAlert />,
  red: <TriangleAlert />,
  none: <CircleHelp />,
  paused: <CirclePause />,
};

const HEADLINE: Record<FinalLevel, string> = {
  green: 'قدماك اليوم سليمة',
  yellow: 'انتبه اليوم',
  orange: 'فيه نقطة تحتاج انتباه',
  red: 'لازم تراجع الطبيب',
  none: 'ما قست اليوم',
  paused: 'المتابعة متوقفة مؤقتًا',
};

/** Big coloured status card. Colour + icon + words: never colour alone. */
export function LevelHero({
  level,
  title,
  reason,
  children,
  className,
  testId,
}: {
  level: FinalLevel;
  title?: string;
  reason?: ReactNode;
  children?: ReactNode;
  className?: string;
  testId?: string;
}) {
  const m = LEVEL[level];
  return (
    <section
      className={cn('relative overflow-hidden rounded-lg border-2 p-5', className)}
      style={{ background: m.soft, borderColor: m.fill }}
      data-testid={testId}
      data-level={level}
    >
      <div className="flex items-start gap-3">
        <span
          className="grid size-12 shrink-0 place-items-center rounded-full text-white [&_svg]:size-7"
          style={{ background: level === 'yellow' ? m.ink : m.fill }}
          aria-hidden
        >
          {ICON[level]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold" style={{ color: m.ink }}>
            المستوى: {m.ar}
          </p>
          <h2 className="text-2xl font-semibold text-ink">{title ?? HEADLINE[level]}</h2>
          {reason && <div className="mt-1 text-base text-ink-2">{reason}</div>}
        </div>
      </div>
      {children && <div className="mt-4 grid gap-2">{children}</div>}
    </section>
  );
}
