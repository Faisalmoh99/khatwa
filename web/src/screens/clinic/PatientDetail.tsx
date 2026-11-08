import { CheckCheck, FileText } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { EventList } from '@/components/kh/EventList';
import { LadderCard } from '@/components/kh/LadderCard';
import { LevelHero } from '@/components/kh/LevelHero';
import { SiteChart } from '@/components/kh/SiteChart';
import { CLINIC_NAV } from '@/components/layout/navs';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardHint, CardTitle } from '@/components/ui/card';
import { dayLabel } from '@/lib/format';
import { baseline, SITES } from '@/lib/rules/rules';
import { writeEvent } from '@/store/device';
import { REAL_ID, usePatient } from '@/store/patients';

export function PatientDetail() {
  const { id } = useParams();
  const p = usePatient(id);
  const [acked, setAcked] = useState(false);
  if (!p) return <Navigate to="/clinic" replace />;
  const base = baseline(p.days);
  const valid = p.days.filter((d) => d.valid).slice(-30);
  const events = [...p.events].reverse().slice(0, 20);

  return (
    <AppShell title={p.name} back="/clinic" nav={CLINIC_NAV}>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={
            p.virtual
              ? 'rounded-full bg-lv-none-soft px-3 py-1 text-sm font-semibold text-lv-none-ink'
              : 'rounded-full bg-brand-100 px-3 py-1 text-sm font-semibold text-brand-900'
          }
          data-testid="patient-kind"
        >
          {p.virtual ? 'مريض افتراضي، بيانات محاكاة' : 'الجهاز الحقيقي'}
        </span>
        {p.age && (
          <span className="text-sm text-mute">
            العمر <span className="num">{p.age}</span>
          </span>
        )}
      </div>

      <LevelHero
        level={p.today.level}
        reason={p.today.reasons.map((r) => r.ar).join('، ')}
        testId="patient-hero"
      />

      <Card className="grid gap-2" data-testid="priority">
        <CardTitle>
          الأولوية: {p.priority.band} (<span className="num">{p.priority.score}</span>)
        </CardTitle>
        {p.priority.parts.length ? (
          <ul className="grid gap-1 text-base text-ink-2">
            {p.priority.parts.map((x) => (
              <li key={x.label} className="flex justify-between gap-2">
                <span>{x.label}</span>
                <span className="num font-semibold text-ink">+{x.pts}</span>
              </li>
            ))}
          </ul>
        ) : (
          <CardHint>ما فيه شي يرفع الأولوية اليوم.</CardHint>
        )}
      </Card>

      <LadderCard state={p.ladder} audience="other" />

      <div className="grid grid-cols-2 gap-3">
        <Button size="lg" asChild>
          <Link to={`/clinic/patient/${p.id}/report`}>
            <FileText /> تقرير الزيارة
          </Link>
        </Button>
        {p.id === REAL_ID && (
          <Button
            size="lg"
            variant="secondary"
            disabled={acked}
            onClick={() =>
              void writeEvent({ kind: 'clinic_ack', data: { note: 'اطّلعت العيادة على الحالة' } }).then(() =>
                setAcked(true),
              )
            }
            data-testid="clinic-ack"
          >
            <CheckCheck /> {acked ? 'تم' : 'اطّلعت'}
          </Button>
        )}
      </div>

      <Card className="grid gap-4">
        <div>
          <CardTitle>الفرق بين القدمين</CardTitle>
          <CardHint>
            آخر {valid.length} قراءات صالحة. الخط المتقطّع = <bdi dir="ltr">±2.2°</bdi>.
          </CardHint>
        </div>
        {valid.length ? (
          SITES.map((_, i) => (
            <SiteChart
              key={i}
              i={i}
              base={base?.[i]?.mean ?? null}
              data={valid.map((d) => ({ key: d.key, label: dayLabel(d.key), v: d.check.diff[i] ?? null }))}
            />
          ))
        ) : (
          <CardHint>ما فيه قراءات.</CardHint>
        )}
      </Card>

      <Card className="grid gap-2">
        <CardTitle>سجل التصعيد والأحداث</CardTitle>
        <EventList
          events={events}
          empty={p.virtual ? 'المرضى الافتراضيون ما لهم سجل أحداث.' : 'ما فيه أحداث بعد.'}
        />
      </Card>
    </AppShell>
  );
}
