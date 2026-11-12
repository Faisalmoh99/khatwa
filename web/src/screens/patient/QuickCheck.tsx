import { useState } from 'react';
import { writeErrorAr } from '@/data/DataSource';
import { Link } from 'react-router-dom';
import { LevelHero } from '@/components/kh/LevelHero';
import { WhatsAppButton } from '@/components/kh/WhatsAppButton';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { CHECK_Q } from '@/lib/checkq';
import { cn } from '@/lib/cn';
import { levelOf, nextSteps, type QuickData } from '@/lib/level';
import { writeEvent } from '@/store/device';
import { useToday } from '@/store/selectors';
import { useSettings } from '@/store/settings';

const TONE = {
  ok: 'border-lv-green data-[on=true]:bg-lv-green-soft',
  warn: 'border-lv-yellow data-[on=true]:bg-lv-yellow-soft',
  bad: 'border-lv-red data-[on=true]:bg-lv-red-soft',
} as const;

export function QuickCheck() {
  const today = useToday();
  const familyConsent = useSettings((s) => s.consents.family);
  const [step, setStep] = useState(0);
  const [ans, setAns] = useState<Partial<QuickData>>({});
  const [saved, setSaved] = useState<QuickData | null>(null);
  const [error, setError] = useState('');
  const q = CHECK_Q[step];

  const choose = async (key: keyof QuickData, value: string) => {
    const next = { ...ans, [key]: value } as Partial<QuickData>;
    setAns(next);
    if (step < CHECK_Q.length - 1) return setStep(step + 1);
    const data = next as QuickData;
    try {
      await writeEvent({ kind: 'quickcheck', data: { ...data }, day: today.key });
      setSaved(data);
    } catch (e) {
      setError(writeErrorAr(e, 'ما قدرنا نحفظ إجابتك. تأكد من الإنترنت وجرّب مرة ثانية.'));
    }
  };

  if (saved) {
    // Show the level from this answer immediately (the store updates a moment later).
    const { level, reasons } = levelOf(today.thermal, saved, today.redflags, today.mode);
    return (
      <AppShell title="الفحص السريع" back="/home">
        <LevelHero level={level} reason={reasons.map((r) => r.ar).join('، ')} testId="quick-result" />
        <Card className="grid gap-2 border-brand-300 bg-brand-50">
          <h2 className="text-lg font-semibold">وش تسوي الحين؟</h2>
          <p className="text-lg">{nextSteps(level, { familyInformed: familyConsent })}</p>
        </Card>
        {(level === 'red' || level === 'yellow' || level === 'orange') && (
          <WhatsAppButton view={{ level, reasons }} />
        )}
        <Button size="lg" block asChild variant="secondary">
          <Link to="/home">الرئيسية</Link>
        </Button>
        <p className="text-center text-sm text-mute">سُجّل فحصك السريع. شكرًا.</p>
      </AppShell>
    );
  }

  return (
    <AppShell title="الفحص السريع" back="/home">
      <p className="text-base text-ink-2">بدل القياس إذا ما قدرت اليوم. ثلاث أسئلة بس.</p>
      <div className="flex gap-2" role="img" aria-label={`السؤال ${step + 1} من ${CHECK_Q.length}`}>
        {CHECK_Q.map((_, i) => (
          <span key={i} className={cn('h-2 flex-1 rounded-full', i <= step ? 'bg-brand-700' : 'bg-line')} />
        ))}
      </div>
      {q && (
        <Card key={step} className="grid animate-fade-up gap-4">
          <p className="text-sm font-semibold text-mute">
            السؤال <span className="num">{step + 1}</span> من <span className="num">{CHECK_Q.length}</span>
          </p>
          <h2 className="text-2xl font-semibold leading-snug text-ink" data-testid="quick-q">
            {q.q}
          </h2>
          <div className="grid gap-3">
            {q.options.map((o) => (
              <button
                key={o.value}
                type="button"
                data-on={ans[q.key] === o.value}
                onClick={() => void choose(q.key, o.value)}
                className={cn(
                  'min-h-touch-lg rounded border-2 bg-surface px-5 text-start text-xl font-semibold text-ink transition-colors duration-kh active:scale-[.99]',
                  TONE[o.tone ?? 'ok'],
                )}
                data-testid={`quick-${q.key}-${o.value}`}
              >
                {o.label}
              </button>
            ))}
          </div>
          {step > 0 && (
            <Button variant="ghost" onClick={() => setStep(step - 1)}>
              السؤال السابق
            </Button>
          )}
        </Card>
      )}
      {error && (
        <p role="alert" className="text-base font-semibold text-lv-red-ink">
          {error}
        </p>
      )}
    </AppShell>
  );
}
