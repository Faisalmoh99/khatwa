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
import { signed } from '@/lib/format';
import { SITES, THRESH } from '@/lib/rules/rules';

export interface Pt {
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

export function SiteChart({ i, data, base }: { i: number; data: Pt[]; base: number | null }) {
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
