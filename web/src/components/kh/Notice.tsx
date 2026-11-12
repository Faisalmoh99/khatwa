import { CircleAlert, Info, TriangleAlert } from 'lucide-react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';
import type { Tone } from '@/lib/quality';

const STYLE: Record<Tone, { box: string; icon: ReactNode }> = {
  info: { box: 'border-brand-300 bg-brand-50 text-brand-900', icon: <Info /> },
  warn: { box: 'border-lv-yellow bg-lv-yellow-soft text-lv-yellow-ink', icon: <CircleAlert /> },
  error: { box: 'border-lv-red bg-lv-red-soft text-lv-red-ink', icon: <TriangleAlert /> },
};

export function Notice({
  tone,
  title,
  children,
  testId,
}: {
  tone: Tone;
  title: string;
  children?: ReactNode;
  testId?: string;
}) {
  const s = STYLE[tone];
  return (
    <div
      className={cn('flex gap-3 rounded border-2 p-4', s.box)}
      role={tone === 'error' ? 'alert' : 'status'}
      data-testid={testId}
    >
      <span className="mt-0.5 shrink-0 [&_svg]:size-6" aria-hidden>
        {s.icon}
      </span>
      <div className="min-w-0">
        <p className="text-lg font-semibold">{title}</p>
        {children && <div className="text-base text-ink">{children}</div>}
      </div>
    </div>
  );
}
