import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { SiteChart } from '@/components/kh/SiteChart';
import { dayLabel } from '@/lib/format';
import { StatusBadge } from '@/components/kh/StatusBadge';
import { PATIENT_NAV } from '@/components/layout/navs';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHint, CardTitle } from '@/components/ui/card';
import { baseline, SITES } from '@/lib/rules/rules';
import { useDayViews, useDays } from '@/store/selectors';
import { useSettings } from '@/store/settings';

export function History() {
  const days = useDays();
  const views = useDayViews();
  const demo = useSettings((s) => s.demoMode);
  const recent = days.slice(-30);
  const base = baseline(days);
  const hasData = recent.some((d) => d.valid);

  return (
    <AppShell title="السجل" nav={PATIENT_NAV}>
      <Card className="grid gap-4">
        <div>
          <CardTitle>الفرق بين القدمين في كل نقطة</CardTitle>
          <CardHint>
            فوق الصفر = اليمنى أسخن، تحت الصفر = اليسرى أسخن. الخط المتقطّع = حد التنبيه{' '}
            <bdi dir="ltr">±2.2°</bdi>. النقطة البرتقالية = فوق الحد.
          </CardHint>
        </div>
        {hasData ? (
          SITES.map((_, i) => (
            <SiteChart
              key={i}
              i={i}
              base={base?.[i]?.mean ?? null}
              data={recent
                .filter((d) => d.valid)
                .map((d) => ({ key: d.key, label: dayLabel(d.key), v: d.check.diff[i] ?? null }))}
            />
          ))
        ) : (
          <p className="py-6 text-center text-base text-mute">ما فيه قراءات بعد. أول قياس بيظهر هنا.</p>
        )}
        {base && (
          <p className="rounded-sm bg-brand-50 p-3 text-sm text-ink-2" data-testid="baseline-note">
            <b>خط الأساس (فرضية):</b> متوسط الفرق في أول {Math.min(7, days.filter((d) => d.valid).length)}{' '}
            أيام قياس. للعرض فقط، ما يغيّر القاعدة ولا التنبيه.
          </p>
        )}
      </Card>

      <Card className="grid gap-1" data-testid="day-list">
        <CardTitle className="mb-1">{demo ? 'أيام العرض' : 'الأيام'}</CardTitle>
        <ul className="divide-y divide-line">
          {[...views]
            .reverse()
            .slice(0, 30)
            .map((v) => (
              <li key={v.key}>
                <Link to={`/result?day=${v.key}`} className="flex min-h-[64px] items-center gap-3 py-2">
                  <span className="w-20 shrink-0 text-base text-ink-2">{dayLabel(v.key)}</span>
                  <span className="min-w-0 flex-1">
                    <StatusBadge level={v.level} />
                    <span className="mt-0.5 block truncate text-sm text-mute">{v.reasons[0]?.ar}</span>
                  </span>
                  <ChevronLeft className="size-5 shrink-0 text-mute" aria-hidden />
                </Link>
              </li>
            ))}
        </ul>
      </Card>
    </AppShell>
  );
}
