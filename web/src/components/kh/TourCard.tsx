import { ChevronLeft, Loader2, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { useDevice } from '@/store/device';
import { endTour, TOUR_STEPS, useTour } from '@/store/tour';

/** The step card. Rendered by AppShell above the bottom navigation while the tour is on. */
export function TourCard({ aboveNav }: { aboveNav: boolean }) {
  const active = useTour((s) => s.active);
  const step = useTour((s) => s.step);
  const nav = useNavigate();
  const redSent = useDevice((d) => d.events.some((e) => e.kind === 'redflag'));
  if (!active) return null;
  const cur = TOUR_STEPS[step];
  if (!cur) return null;
  const last = step === TOUR_STEPS.length - 1;
  const waiting = cur.action !== 'none' || (cur.id === 'rafiq' && !redSent);
  const finish = () => nav(endTour(), { replace: true });

  return (
    <section
      className={cn(
        'fixed inset-x-0 z-40 mx-auto max-w-screen-sm px-3 print:hidden',
        cur.top
          ? 'top-[calc(var(--kh-banner-h,0px)+4.5rem)]'
          : aboveNav
            ? 'bottom-[calc(5.25rem+env(safe-area-inset-bottom))]'
            : 'bottom-[calc(0.75rem+env(safe-area-inset-bottom))]',
      )}
      aria-label="جولة السيناريو"
      data-testid="tour-card"
      data-step={cur.id}
    >
      <div className="grid gap-2 rounded-lg border-2 border-brand-700 bg-surface p-3 shadow-card">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-brand-700 px-2.5 py-0.5 text-sm font-semibold text-white">
            <span className="num">{step + 1}</span> من <span className="num">{TOUR_STEPS.length}</span>
          </span>
          <h2 className="flex-1 truncate text-lg font-semibold text-brand-900">{cur.title}</h2>
          <button
            type="button"
            onClick={finish}
            aria-label="أنهِ الجولة"
            className="grid size-11 place-items-center rounded-full text-mute hover:bg-brand-50"
            data-testid="tour-exit"
          >
            <X className="size-5" />
          </button>
        </div>
        <p className="text-base leading-relaxed text-ink">{cur.body}</p>
        {waiting ? (
          <p className="flex items-center gap-2 text-base font-semibold text-brand-700" role="status">
            <Loader2 className="size-5 animate-spin" aria-hidden />{' '}
            {cur.action !== 'none' ? 'القياس شغّال (محاكاة)…' : 'رفيق يقرأ الرسالة…'}
          </p>
        ) : (
          <Button
            size="lg"
            onClick={() => (last ? finish() : useTour.getState().set({ step: step + 1 }))}
            data-testid="tour-next"
          >
            {last ? 'انتهت الجولة' : 'التالي'} {!last && <ChevronLeft />}
          </Button>
        )}
      </div>
    </section>
  );
}

/** Space under the page so the card never hides the last element. */
export function TourSpacer() {
  const active = useTour((s) => s.active);
  return active ? <div aria-hidden className="h-48" /> : null;
}
