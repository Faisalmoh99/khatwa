import { FlaskConical, RefreshCw } from 'lucide-react';
import { useEffect, useState } from 'react';
import { CLINIC_NAV } from '@/components/layout/navs';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardHint, CardTitle } from '@/components/ui/card';
import { ASSUME, type LabResult } from '@/lib/ruleLab';
import { cn } from '@/lib/cn';

function run(seed: number): Promise<LabResult[]> {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('../../lib/ruleLab.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e: MessageEvent<LabResult[]>) => (resolve(e.data), w.terminate());
    w.onerror = (e) => (reject(e), w.terminate());
    w.postMessage({ seed });
  });
}

function Bar({ v, max, tone }: { v: number; max: number; tone: 'bad' | 'good' }) {
  return (
    <span className="block h-2.5 w-full overflow-hidden rounded-full bg-line" aria-hidden>
      <span
        className={cn('block h-full rounded-full', tone === 'bad' ? 'bg-lv-orange' : 'bg-brand-700')}
        style={{ width: `${Math.max(2, (v / (max || 1)) * 100)}%` }}
      />
    </span>
  );
}

/** Rule lab: simulated comparison of alert rules. Clearly labelled as simulation from our assumptions. */
export function RuleLab() {
  const [seed, setSeed] = useState(2026);
  const [res, setRes] = useState<LabResult[] | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let alive = true;
    void run(seed)
      .then((r) => alive && setRes(r))
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
    };
  }, [seed]);

  const maxF = Math.max(...(res ?? []).map((r) => r.falsePer100), 1);

  return (
    <AppShell title="مختبر القاعدة" nav={CLINIC_NAV}>
      <div
        className="flex gap-3 rounded border-2 border-lv-yellow bg-lv-yellow-soft p-4"
        role="note"
        data-testid="lab-warning"
      >
        <FlaskConical className="mt-0.5 size-6 shrink-0 text-lv-yellow-ink" aria-hidden />
        <p className="text-base font-semibold text-ink">
          محاكاة، أرقام من افتراضاتنا. 400 مريض اصطناعي لمدة 30 يومًا، مو بيانات مرضى.
        </p>
      </div>

      <Card className="grid gap-4" data-testid="lab-table">
        <div>
          <CardTitle>مقارنة القواعد</CardTitle>
          <CardHint>
            الإنذارات الكاذبة لكل 100 مريض سليم في الشهر، ونسبة النقاط الساخنة اللي انكشفت، ووسيط الأيام من
            بدايتها للتنبيه.
          </CardHint>
        </div>
        {busy || !res ? (
          <p className="py-6 text-center text-base text-mute" role="status">
            جارٍ الحساب…
          </p>
        ) : (
          <ul className="grid gap-4">
            {res.map((r) => (
              <li
                key={r.key}
                className={cn(
                  'grid gap-2 rounded-sm p-3',
                  r.key === 'two' ? 'bg-brand-50 ring-2 ring-brand-300' : 'bg-bg',
                )}
                data-testid={`lab-${r.key}`}
              >
                <p className="text-base font-semibold text-ink">{r.label}</p>
                <div className="grid grid-cols-[1fr_auto] items-center gap-x-3 gap-y-1 text-sm text-ink-2">
                  <span>إنذارات كاذبة / 100 مريض</span>
                  <b className="num text-ink">{r.falsePer100.toFixed(0)}</b>
                  <Bar v={r.falsePer100} max={maxF} tone="bad" />
                  <span />
                  <span>نقاط ساخنة انكشفت</span>
                  <b className="num text-ink">{Math.round(r.sensitivity * 100)}%</b>
                  <Bar v={r.sensitivity} max={1} tone="good" />
                  <span />
                  <span>أيام من البداية للتنبيه (الوسيط)</span>
                  <b className="num text-ink">{r.medianDelay ?? '—'}</b>
                </div>
              </li>
            ))}
          </ul>
        )}
        <Button
          variant="secondary"
          onClick={() => (setBusy(true), setSeed(Math.floor(Math.random() * 1e6)))}
          disabled={busy}
        >
          <RefreshCw /> أعد المحاكاة بعيّنة ثانية
        </Button>
      </Card>

      <Card className="grid gap-2">
        <CardTitle>الافتراضات</CardTitle>
        <ul className="grid list-disc gap-1 ps-5 text-sm text-ink-2" data-testid="lab-assume">
          {ASSUME.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
        <CardHint>القاعدة «أ» هنا هي نفس محرك القاعدة في التطبيق (rules.ts).</CardHint>
      </Card>
    </AppShell>
  );
}
