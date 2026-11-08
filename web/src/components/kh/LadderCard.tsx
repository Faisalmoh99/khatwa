import { LADDER_STEPS, type LadderState, ladderText } from '@/lib/ladder';
import { cn } from '@/lib/cn';
import { Card, CardTitle } from '@/components/ui/card';

/** The 4-step adherence ladder with the current step highlighted. */
export function LadderCard({
  state,
  audience = 'patient',
}: {
  state: LadderState;
  audience?: 'patient' | 'other';
}) {
  return (
    <Card className="grid gap-3" data-testid="ladder">
      <div className="flex items-center justify-between gap-2">
        <CardTitle>سلّم المتابعة</CardTitle>
        {state.paused && (
          <span className="rounded-full bg-lv-none-soft px-3 py-0.5 text-sm font-semibold text-lv-none-ink">
            متوقف
          </span>
        )}
      </div>
      <ol className="grid grid-cols-4 gap-1.5">
        {LADDER_STEPS.map((label, i) => {
          const n = i + 1;
          const on = !state.paused && n <= state.step;
          const now = !state.paused && n === state.step;
          return (
            <li key={label} className="grid gap-1.5" aria-current={now ? 'step' : undefined}>
              <span
                className={cn(
                  'h-2 rounded-full',
                  on ? (n >= 3 ? 'bg-lv-orange' : 'bg-brand-700') : 'bg-line',
                )}
              />
              <span className={cn('text-xs leading-snug', now ? 'font-semibold text-ink' : 'text-mute')}>
                <b className="num">{n}</b> {label}
              </span>
            </li>
          );
        })}
      </ol>
      <p className="text-base text-ink-2" data-testid="ladder-text">
        {ladderText(state, audience)}
      </p>
    </Card>
  );
}
