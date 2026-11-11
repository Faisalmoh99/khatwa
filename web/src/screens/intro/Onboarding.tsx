import { Building2, Droplets, Footprints, HeartHandshake, PlayCircle, User } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { FootMap } from '@/components/kh/FootMap';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';
import { BUILD_STATUS_AR } from '@/lib/words';
import { useSettings } from '@/store/settings';
import { startTour } from '@/store/tour';

interface Slide {
  title: string;
  body: string;
  art: ReactNode;
}

function Bubble({
  children,
  label,
  tone = 'brand',
}: {
  children: ReactNode;
  label: string;
  tone?: 'brand' | 'soft';
}) {
  return (
    <div className="grid justify-items-center gap-2">
      <span
        className={cn(
          'grid size-20 place-items-center rounded-full [&_svg]:size-9',
          tone === 'brand' ? 'bg-brand-700 text-white' : 'bg-brand-100 text-brand-700',
        )}
      >
        {children}
      </span>
      <span className="text-base font-semibold text-ink">{label}</span>
    </div>
  );
}

const SLIDES: Slide[] = [
  {
    title: 'وش خطوة؟',
    body: `سجادة عند مكان الوضوء تقارن حرارة القدمين ببعض. إذا صار فرق واضح يومين ورا بعض، ننبّهك بدري. ${BUILD_STATUS_AR}.`,
    art: <FootMap compact showValues={false} highlight={{ L: [], R: [1] }} />,
  },
  {
    title: 'كيف تقيس؟',
    body: 'كل يوم قبل الوضوء: قف بالقدمين على السجادة وقدمك ناشفة، واثبت لين يقول لك الجوال «تم».',
    art: (
      <div className="flex items-center justify-center gap-6">
        <Bubble label="قبل الوضوء" tone="soft">
          <Droplets />
        </Bubble>
        <Bubble label="قف واثبت">
          <Footprints />
        </Bubble>
      </div>
    ),
  },
  {
    title: 'مين يوصله التنبيه؟',
    body: 'أنت أولًا. وإذا احتاج الأمر، عائلتك (بموافقتك)، ثم العيادة. خطوة أداة مراقبة تساعد على الإحالة، مو تشخيص.',
    art: (
      <div className="flex items-start justify-center gap-4">
        <Bubble label="أنت">
          <User />
        </Bubble>
        <Bubble label="العائلة" tone="soft">
          <HeartHandshake />
        </Bubble>
        <Bubble label="العيادة" tone="soft">
          <Building2 />
        </Bubble>
      </div>
    ),
  },
];

export function Onboarding() {
  const [i, setI] = useState(0);
  const nav = useNavigate();
  const set = useSettings((s) => s.set);
  const finish = () => {
    set({ onboarded: true });
    nav('/', { replace: true });
  };
  const s = SLIDES[i]!;
  const last = i === SLIDES.length - 1;

  return (
    <div className="mx-auto flex min-h-dvh max-w-screen-sm flex-col px-5 pb-[max(24px,env(safe-area-inset-bottom))] pt-4">
      <div className="flex h-12 items-center justify-between">
        <img src="/logo.png" alt="" width={36} height={36} className="rounded-sm" />
        {!last && (
          <Button variant="ghost" onClick={finish} data-testid="onb-skip">
            تخطّي
          </Button>
        )}
      </div>
      <section
        key={i}
        className="flex flex-1 animate-fade-up flex-col justify-center gap-8"
        aria-live="polite"
      >
        <div className="grid min-h-[260px] place-items-center rounded-lg bg-brand-50 px-4 py-6">{s.art}</div>
        <div className="grid gap-3">
          <h1 className="text-3xl font-semibold text-brand-900">{s.title}</h1>
          <p className="text-lg text-ink-2">{s.body}</p>
        </div>
      </section>
      <div className="grid gap-5 pt-6">
        <div
          className="flex justify-center gap-2"
          role="img"
          aria-label={`الشاشة ${i + 1} من ${SLIDES.length}`}
        >
          {SLIDES.map((_, k) => (
            <span
              key={k}
              className={cn(
                'h-2.5 rounded-full transition-all duration-kh',
                k === i ? 'w-8 bg-brand-700' : 'w-2.5 bg-line-strong',
              )}
            />
          ))}
        </div>
        <Button size="lg" block onClick={() => (last ? finish() : setI(i + 1))} data-testid="onb-next">
          {last ? 'يلا نبدأ' : 'التالي'}
        </Button>
        <Button size="lg" block variant="soft" onClick={startTour} data-testid="onb-tour">
          <PlayCircle /> جرّب السيناريو بدون تسجيل
        </Button>
      </div>
    </div>
  );
}
