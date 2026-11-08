import { CheckCircle2, Droplets, Footprints, Hand, WifiOff } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FootMap } from '@/components/kh/FootMap';
import { Notice } from '@/components/kh/Notice';
import { Num } from '@/components/kh/Num';
import { ProgressRing } from '@/components/kh/ProgressRing';
import { SimPanel } from '@/components/kh/SimPanel';
import { PATIENT_NAV } from '@/components/layout/navs';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useNow } from '@/hooks/useNow';
import { checkScan, liveMessages, type QualityMsg, scanProblems } from '@/lib/quality';
import { serverNow, useDevice } from '@/store/device';

/** Live messages plus any seen in the last 3 s (kept by the store), so a brief warning is readable. */
function useStickyMessages(current: QualityMsg[], phase: string | undefined): QualityMsg[] {
  const kept = useDevice((s) => s.liveMsgs);
  const now = useNow(250);
  if (phase === 'idle' || phase === 'done') return current;
  const shown = new Set(current.map((m) => m.code));
  return [
    ...current,
    ...Object.values(kept)
      .filter((x) => x.until > now && !shown.has(x.m.code))
      .map((x) => x.m),
  ];
}

function Step({ n, icon, children }: { n: number; icon: ReactNode; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700 [&_svg]:size-6">
        {icon}
      </span>
      <span className="flex gap-2 text-lg text-ink">
        <b className="num text-brand-700">{n}</b>
        <span>{children}</span>
      </span>
    </li>
  );
}

const PHASE_TITLE = {
  idle: 'قف على السجادة',
  placing: 'نتحقق من وقوفك…',
  settling: 'اثبت مكانك، نقيس الحين',
  done: 'تم القياس',
  error: 'ما اكتمل القياس',
} as const;

export function Scan() {
  const live = useDevice((s) => s.live);
  const online = useDevice((s) => s.online);
  const scans = useDevice((s) => s.scans);
  const nav = useNavigate();
  const [openedAt] = useState(() => serverNow());
  const [dismissed, setDismissed] = useState<string | null>(null);

  /** A scan that finished while this screen is open (server time), and not dismissed by "retry". */
  const fresh = useMemo(() => {
    const last = scans.at(-1);
    return last && last.ts >= openedAt - 2000 && last.id !== dismissed && !last.backfill ? last : undefined;
  }, [scans, openedAt, dismissed]);
  const problems = useMemo(() => (fresh ? scanProblems(checkScan(fresh)) : []), [fresh]);
  const ok = fresh && problems.length === 0;

  useEffect(() => {
    if (!ok) return;
    const t = setTimeout(() => nav('/result'), 1200);
    return () => clearTimeout(t);
  }, [ok, nav]);

  const phase = live?.phase ?? 'idle';
  // Measurement started: bring the ring and the map into view.
  useEffect(() => {
    if (phase === 'placing') window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [phase]);
  const measuring = phase === 'placing' || phase === 'settling';
  const msgs = useStickyMessages(liveMessages(live), live?.phase);
  const retry = () => setDismissed(fresh?.id ?? null);

  return (
    <AppShell nav={PATIENT_NAV} title="الفحص">
      {!online && !measuring && (
        <Notice tone="warn" title="السجادة غير متصلة" testId="scan-offline">
          تأكد إنها موصولة بالكهرباء والواي فاي شغال.{' '}
          <Link to="/device" className="font-semibold text-brand-700 underline">
            جهازي
          </Link>
        </Notice>
      )}

      <div className="grid gap-3" aria-live="polite" data-testid="scan-messages">
        {(fresh ? problems : msgs).map((m) => (
          <Notice key={m.code} tone={m.tone} title={m.title} testId={`q-${m.code}`}>
            {m.body}
          </Notice>
        ))}
      </div>

      <Card className="grid justify-items-center gap-4 py-6" data-testid="scan-card">
        <h2 className="text-2xl font-semibold text-brand-900" data-testid="scan-phase" aria-live="polite">
          {fresh && !ok ? 'ما انحسبت القراءة' : PHASE_TITLE[phase]}
        </h2>

        {measuring && (
          <ProgressRing value={live?.progress ?? 0} label="تقدم القياس" size={168}>
            <span className="grid justify-items-center">
              <span className="text-3xl font-semibold text-brand-900">
                <Num>{live?.progress ?? 0}%</Num>
              </span>
              <span className="text-sm text-mute">لا تتحرك</span>
            </span>
          </ProgressRing>
        )}
        {ok && (
          <span className="grid justify-items-center gap-2 text-lv-green-ink" data-testid="scan-done">
            <CheckCircle2 className="size-16" aria-hidden />
            <span className="text-lg font-semibold">تم. نجهّز النتيجة…</span>
          </span>
        )}

        <FootMap L={live?.L} R={live?.R} compact={measuring} />

        {phase === 'idle' && !fresh && (
          <ol className="grid w-full gap-3 px-1" data-testid="scan-steps">
            <Step n={1} icon={<Droplets />}>
              قدمك ناشفة، قبل الوضوء
            </Step>
            <Step n={2} icon={<Footprints />}>
              قف بالقدمين على السجادة
            </Step>
            <Step n={3} icon={<Hand />}>
              اثبت لين نقول لك «تم»
            </Step>
          </ol>
        )}
      </Card>

      {fresh && !ok && (
        <Button size="lg" block onClick={retry} data-testid="scan-retry">
          أعد القياس
        </Button>
      )}

      {!online && phase === 'idle' && (
        <p className="flex items-center justify-center gap-2 text-sm text-mute">
          <WifiOff className="size-4" aria-hidden /> ننتظر السجادة…
        </p>
      )}

      <SimPanel compact />
    </AppShell>
  );
}
