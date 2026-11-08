import { Cpu, Wifi, WifiOff } from 'lucide-react';
import { FootMap } from '@/components/kh/FootMap';
import { Num } from '@/components/kh/Num';
import { ProgressRing } from '@/components/kh/ProgressRing';
import { SimPanel } from '@/components/kh/SimPanel';
import { StatusBadge } from '@/components/kh/StatusBadge';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardHint, CardTitle } from '@/components/ui/card';
import { useNow } from '@/hooks/useNow';
import { ago, arDate } from '@/lib/format';
import { describe } from '@/lib/rules/rules';
import { useDevice } from '@/store/device';
import { useDays } from '@/store/selectors';

const PHASE_AR = {
  idle: 'قف على السجادة بالقدمين',
  placing: 'نتحقق من وقوفك…',
  settling: 'ثبّت قدميك، نقيس الحين…',
  done: 'تم القياس',
  error: 'ما اكتمل القياس',
} as const;

/**
 * Phase 0 home: proves the data path end to end (device → source → store → screen).
 * Replaced by the full patient home in phase 1.
 */
export function Home() {
  const live = useDevice((s) => s.live);
  const status = useDevice((s) => s.status);
  const online = useDevice((s) => s.online);
  const scans = useDevice((s) => s.scans);
  const rejected = useDevice((s) => s.rejected);
  const loaded = useDevice((s) => s.loaded);
  const source = useDevice((s) => s.source);
  const days = useDays();
  const now = useNow(5000);
  const last = days.at(-1);
  const lastScan = scans.at(-1);
  const phase = live?.phase ?? 'idle';
  const measuring = phase === 'placing' || phase === 'settling';

  return (
    <AppShell>
      <Card className="flex items-center gap-3" data-testid="device-card">
        <span className={online ? 'text-lv-green-ink' : 'text-mute'}>
          {online ? <Wifi className="size-7" /> : <WifiOff className="size-7" />}
        </span>
        <div className="flex-1">
          <p className="text-lg font-semibold" data-testid="device-online">
            {online ? 'السجادة متصلة' : 'السجادة غير متصلة'}
          </p>
          <p className="text-sm text-mute">
            {status?.lastSeen ? (
              <>آخر نبضة {ago((source?.serverNow() ?? now) - status.lastSeen)}</>
            ) : (
              'ما وصلت أي نبضة بعد'
            )}
            {status?.firmware && (
              <>
                {' · '}النسخة <Num>{status.firmware}</Num>
              </>
            )}
          </p>
        </div>
        <Cpu className="size-6 text-brand-300" aria-hidden />
      </Card>

      <Card className="grid justify-items-center gap-3" data-testid="live-card">
        <div className="w-full">
          <CardTitle>القياس الحي</CardTitle>
          <CardHint data-testid="live-phase">
            {live?.msg && phase !== 'settling' ? live.msg : PHASE_AR[phase]}
          </CardHint>
        </div>
        {measuring ? (
          <ProgressRing value={live?.progress ?? 0} label="تقدم القياس" size={140}>
            <span className="text-2xl font-semibold text-brand-900">
              <Num>{live?.progress ?? 0}%</Num>
            </span>
          </ProgressRing>
        ) : null}
        <FootMap L={live?.L} R={live?.R} />
      </Card>

      <Card className="grid gap-2" data-testid="result-card">
        <CardTitle>آخر نتيجة</CardTitle>
        {!loaded ? (
          <CardHint>جارٍ التحميل…</CardHint>
        ) : last ? (
          <>
            <div className="flex items-center gap-3">
              <StatusBadge level={last.level} size="lg" />
              <span className="text-sm text-mute">{arDate(Number(last.scan.ts))}</span>
            </div>
            <p className="text-base" data-testid="result-text">
              {describe(last)}
            </p>
          </>
        ) : (
          <CardHint>ما فيه قراءات بعد.</CardHint>
        )}
        <p className="text-sm text-mute">
          القراءات المسجّلة: <Num>{scans.length}</Num>
          {rejected.length > 0 && (
            <>
              {' · '}مرفوضة لشكلها: <Num>{rejected.length}</Num>
            </>
          )}
          {lastScan?.source === 'sim' && ' · مصدرها المحاكي'}
        </p>
      </Card>

      <SimPanel />
    </AppShell>
  );
}
