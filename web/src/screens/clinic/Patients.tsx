import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import { StatusBadge } from '@/components/kh/StatusBadge';
import { CLINIC_NAV } from '@/components/layout/navs';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/cn';
import { ownPatientTag } from '@/lib/words';
import { useSettings } from '@/store/settings';
import { usePatients } from '@/store/patients';

const BAND = {
  عاجل: 'bg-lv-red-soft text-lv-red-ink',
  مرتفع: 'bg-lv-orange-soft text-lv-orange-ink',
  متابعة: 'bg-lv-yellow-soft text-lv-yellow-ink',
  عادي: 'bg-lv-none-soft text-lv-none-ink',
} as const;

export function Patients() {
  const kind = useSettings((s) => s.dataSource);
  const list = usePatients();
  return (
    <AppShell title="المرضى" nav={CLINIC_NAV}>
      <p className="text-base text-ink-2">
        مرتّبون حسب الأولوية: الأحمر أولًا، ثم البرتقالي، ثم الأصفر. مريض السجادة ({ownPatientTag(kind)})،
        والبقية <b>افتراضيون</b> ببيانات محاكاة.
      </p>
      <ul className="grid gap-3" data-testid="patients">
        {list.map((p) => (
          <li key={p.id}>
            <Link to={`/clinic/patient/${p.id}`} data-testid={`patient-${p.id}`} data-level={p.today.level}>
              <Card className={cn('flex items-center gap-3 p-3', !p.virtual && 'border-2 border-brand-500')}>
                <span
                  className={cn(
                    'grid size-12 shrink-0 place-items-center rounded-full text-lg font-semibold',
                    p.virtual ? 'bg-lv-none-soft text-lv-none-ink' : 'bg-brand-700 text-white',
                  )}
                  aria-hidden
                >
                  {p.name.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="text-lg font-semibold text-ink">{p.name}</span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-xs font-semibold',
                        p.virtual ? 'bg-lv-none-soft text-lv-none-ink' : 'bg-brand-100 text-brand-900',
                      )}
                    >
                      {p.virtual ? 'افتراضي' : ownPatientTag(kind)}
                    </span>
                  </span>
                  <span className="mt-1 flex flex-wrap items-center gap-2">
                    <StatusBadge level={p.today.level} />
                    <span
                      className={cn('rounded-full px-2 py-0.5 text-sm font-semibold', BAND[p.priority.band])}
                    >
                      الأولوية: {p.priority.band} (<span className="num">{p.priority.score}</span>)
                    </span>
                  </span>
                  <span className="mt-1 block truncate text-sm text-mute">{p.today.reasons[0]?.ar}</span>
                </span>
                <ChevronLeft className="size-6 shrink-0 text-mute" aria-hidden />
              </Card>
            </Link>
          </li>
        ))}
      </ul>
      <p className="text-sm text-mute">
        الأولوية مجموع نقاط معلن (نقطة ساخنة، أيام بلا قياس، علامة خطر…)، مو درجة خطورة سريرية.
      </p>
    </AppShell>
  );
}
