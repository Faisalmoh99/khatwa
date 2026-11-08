import { ChevronLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { StatusBadge } from '@/components/kh/StatusBadge';
import { PATIENT_NAV } from '@/components/layout/navs';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHint, CardTitle } from '@/components/ui/card';
import { baseline, SITES, THRESH } from '@/lib/rules/rules';
import { useDayViews, useDays } from '@/store/selectors';
import { useSettings } from '@/store/settings';

const SHORT = new Intl.DateTimeFormat('ar-SA-u-nu-latn-ca-gregory', {
  day: 'numeric',
  month: 'short',
  timeZone: 'UTC',
});
const dayLabel = (key: string) =>
  key.startsWith('D') ? `يوم ${key.slice(1)}` : SHORT.format(new Date(key + 'T12:00:00Z'));

/** "+0.3°", "-1.2°", and "0.0°" instead of "-0.0°". */
const signed = (v: number) => {
  const r = Math.round(v * 10) / 10;
  return r === 0 ? '0.0°' : `${r > 0 ? '+' : ''}${r.toFixed(1)}°`;
};

interface Pt {
  key: string;
  label: string;
  v: number | null;
}

function SiteDot(props: { cx?: number; cy?: number; payload?: Pt }) {
  const { cx, cy, payload } = props;
  if (cx === undefined || cy === undefined || payload?.v === null || payload?.v === undefined) return null;
  const hot = Math.abs(payload.v) > THRESH;
  return (
    <circle
      cx={cx}
      cy={cy}
      r={hot ? 5.5 : 4}
      fill={hot ? 'var(--kh-orange)' : 'var(--kh-brand-700)'}
      stroke="#fff"
      strokeWidth={2}
    />
  );
}

function Tip({ active, payload }: { active?: boolean; payload?: { payload: Pt }[] }) {
  const p = payload?.[0]?.payload;
  if (!active || !p || p.v === null) return null;
  const foot = p.v > 0 ? 'اليمنى أسخن' : p.v < 0 ? 'اليسرى أسخن' : 'متساويتين';
  return (
    <div className="rounded-sm border border-line bg-surface px-3 py-2 text-sm shadow-lift">
      <p className="font-semibold text-ink">{p.label}</p>
      <p className="text-ink-2">
        الفرق{' '}
        <bdi dir="ltr" className="num font-semibold text-ink">
          {signed(p.v)}
        </bdi>{' '}
        · {foot}
      </p>
    </div>
  );
}

function SiteChart({ i, data, base }: { i: number; data: Pt[]; base: number | null }) {
  const vals = data.map((d) => d.v).filter((v): v is number => v !== null);
  const lim = Math.max(3.5, Math.ceil(Math.max(0, ...vals.map(Math.abs)) + 0.5));
  return (
    <figure className="grid gap-1" data-testid={`chart-${SITES[i]!.id}`}>
      <figcaption className="flex items-baseline justify-between">
        <span className="text-base font-semibold text-ink">{SITES[i]!.ar}</span>
        {base !== null && (
          <span className="text-sm text-mute">
            خط الأساس{' '}
            <bdi dir="ltr" className="num">
              {signed(base)}
            </bdi>{' '}
            (فرضية)
          </span>
        )}
      </figcaption>
      <div className="h-36" dir="ltr">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: 4 }}>
            <CartesianGrid vertical={false} stroke="var(--kh-line)" strokeDasharray="0" />
            <XAxis
              dataKey="label"
              reversed
              tick={{ fontSize: 12, fill: 'var(--kh-mute)' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              orientation="right"
              domain={[-lim, lim]}
              ticks={[-THRESH, 0, THRESH]}
              tickFormatter={(v: number) => (v > 0 ? `+${v}` : `${v}`)}
              tick={{ fontSize: 12, fill: 'var(--kh-mute)' }}
              tickLine={false}
              axisLine={false}
              width={36}
            />
            <ReferenceLine y={THRESH} stroke="var(--kh-ink-2)" strokeDasharray="4 4" strokeWidth={1} />
            <ReferenceLine y={-THRESH} stroke="var(--kh-ink-2)" strokeDasharray="4 4" strokeWidth={1} />
            <ReferenceLine y={0} stroke="var(--kh-line-strong)" strokeWidth={1} />
            {base !== null && (
              <ReferenceLine y={base} stroke="var(--kh-brand-300)" strokeDasharray="2 3" strokeWidth={2} />
            )}
            <Tooltip content={<Tip />} cursor={{ stroke: 'var(--kh-line-strong)', strokeWidth: 1 }} />
            <Line
              type="monotone"
              dataKey="v"
              stroke="var(--kh-brand-700)"
              strokeWidth={2}
              dot={<SiteDot />}
              activeDot={{ r: 7 }}
              connectNulls
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </figure>
  );
}

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
