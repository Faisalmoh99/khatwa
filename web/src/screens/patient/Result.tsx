import { Camera, ClipboardCheck, House, MessageCircle, Footprints } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';
import { FootMap } from '@/components/kh/FootMap';
import { LevelHero } from '@/components/kh/LevelHero';
import { WhatsAppButton } from '@/components/kh/WhatsAppButton';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardTitle } from '@/components/ui/card';
import { arDate, clock } from '@/lib/format';
import { focusSite, nextSteps } from '@/lib/level';
import { coverageNote } from '@/lib/quality';
import { useDayViews } from '@/store/selectors';
import { useSettings } from '@/store/settings';

export function Result() {
  const [q] = useSearchParams();
  const views = useDayViews();
  const familyConsent = useSettings((s) => s.consents.family);
  const view = (q.get('day') && views.find((v) => v.key === q.get('day'))) || views.at(-1)!;
  const scan = view.thermal?.scan;
  const focus = focusSite(view);
  const coverage = view.thermal ? coverageNote(view.thermal.check) : null;
  const isSim = scan?.source === 'sim' || scan?.backfill === true;

  return (
    <AppShell title="النتيجة" back="/home">
      <div className="flex flex-wrap items-center gap-2 text-sm text-mute">
        <span>{view.key.startsWith('D') ? `يوم العرض ${view.key.slice(1)}` : arDate(view.ts)}</span>
        {scan && (
          <span>
            · الساعة <span className="num">{clock(Number(scan.ts))}</span>
          </span>
        )}
        {isSim && (
          <span className="rounded-full bg-brand-100 px-2 py-0.5 font-semibold text-brand-900">
            قراءة محاكاة
          </span>
        )}
      </div>

      <LevelHero
        level={view.level}
        // Never "قدماك اليوم سليمة" when a point was not measured.
        title={coverage && view.level === 'green' ? 'ما فيه فرق في النقاط اللي قسناها' : undefined}
        testId="result-hero"
      />

      <Card className="grid gap-3">
        <CardTitle>ليش؟</CardTitle>
        <ul className="grid gap-2" data-testid="result-reasons">
          {view.reasons.map((r) => (
            <li key={r.code + r.ar} className="flex gap-2 text-lg text-ink">
              <span aria-hidden className="mt-3 size-2 shrink-0 rounded-full bg-brand-500" />
              <span>{r.ar}</span>
            </li>
          ))}
        </ul>
        {coverage && (
          <p
            className="rounded border border-lv-yellow bg-lv-yellow-soft px-3 py-2 text-base font-semibold text-lv-yellow-ink"
            data-testid="result-coverage"
          >
            {coverage}
          </p>
        )}
        {scan && (
          <FootMap
            L={scan.L as number[]}
            R={scan.R as number[]}
            highlight={
              focus
                ? { L: focus.foot === 'L' ? [focus.i] : [], R: focus.foot === 'R' ? [focus.i] : [] }
                : { L: [], R: [] }
            }
          />
        )}
      </Card>

      <Card className="grid gap-2 border-brand-300 bg-brand-50">
        <CardTitle>وش تسوي الحين؟</CardTitle>
        <p className="text-lg text-ink" data-testid="result-next">
          {nextSteps(view.level, { mode: view.mode, familyInformed: familyConsent })}
        </p>
      </Card>

      {(view.level === 'orange' || view.level === 'red' || view.level === 'yellow') && (
        <WhatsAppButton view={view} />
      )}
      {(view.level === 'orange' || view.level === 'red') && (
        <Button variant="secondary" size="lg" asChild>
          <Link to="/photo">
            <Camera /> صوّر المكان للعيادة
          </Link>
        </Button>
      )}

      <div className="grid grid-cols-2 gap-3">
        {!view.done ? (
          <Button size="lg" asChild>
            <Link to="/scan">
              <Footprints /> ابدأ الفحص
            </Link>
          </Button>
        ) : (
          <Button variant="soft" size="lg" asChild>
            <Link to="/quick">
              <ClipboardCheck /> فحص سريع
            </Link>
          </Button>
        )}
        <Button variant="soft" size="lg" asChild>
          <Link to="/assistant">
            <MessageCircle /> اسأل المساعد
          </Link>
        </Button>
      </div>
      <Button variant="ghost" size="lg" asChild>
        <Link to="/home">
          <House /> الرئيسية
        </Link>
      </Button>

      <p className="text-center text-sm text-mute">خطوة أداة مراقبة تساعد على الإحالة، مو تشخيص.</p>
    </AppShell>
  );
}
