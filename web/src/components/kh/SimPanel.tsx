import { History, Play, Square, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHint, CardTitle } from '@/components/ui/card';
import { SwitchRow } from '@/components/ui/switch';
import { SimulationSource } from '@/data/SimulationSource';
import { useDevice } from '@/store/device';
import { useNextDemoDay } from '@/store/selectors';
import { useSettings } from '@/store/settings';

/** Controls for the in-browser simulator. Only rendered when the simulation source is active. */
export function SimPanel() {
  const src = useDevice((s) => s.source);
  const live = useDevice((s) => s.live);
  const demo = useSettings((s) => s.demoMode);
  const nextDay = useNextDemoDay();
  const [scn, setScn] = useState('hot');
  const [days, setDays] = useState('developing');
  const [hb, setHb] = useState(true);
  if (!(src instanceof SimulationSource)) return null;
  const busy = live?.phase === 'placing' || live?.phase === 'settling';

  return (
    <Card className="grid gap-3 border-dashed border-brand-300 bg-brand-50" data-testid="sim-panel">
      <div>
        <CardTitle>لوحة المحاكاة</CardTitle>
        <CardHint>قراءات وهمية بنفس شكل الجهاز. كل شي هنا «محاكاة».</CardHint>
      </div>
      <label className="grid gap-1 text-sm text-ink-2">
        حالة الوقوف
        <select
          className="min-h-touch w-full min-w-0 truncate rounded-sm border-2 border-line bg-surface px-3 text-base"
          value={scn}
          onChange={(e) => setScn(e.target.value)}
          data-testid="sim-scenario"
        >
          {SimulationSource.liveScenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.ar}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <Button
          className="flex-1"
          disabled={busy}
          onClick={() => src.startScan(scn, demo ? { demoDay: nextDay } : {})}
          data-testid="sim-start"
        >
          <Play /> ابدأ الوقوف{demo ? ` (يوم ${nextDay})` : ''}
        </Button>
        <Button variant="secondary" disabled={!busy} onClick={() => src.stepOff()}>
          <Square /> انزل
        </Button>
      </div>
      <label className="grid gap-1 text-sm text-ink-2">
        تاريخ 30 يومًا
        <select
          className="min-h-touch w-full min-w-0 truncate rounded-sm border-2 border-line bg-surface px-3 text-base"
          value={days}
          onChange={(e) => setDays(e.target.value)}
        >
          {SimulationSource.daysScenarios.map((s) => (
            <option key={s.id} value={s.id}>
              {s.ar}: {s.desc}
            </option>
          ))}
        </select>
      </label>
      <div className="flex gap-2">
        <Button
          variant="soft"
          className="flex-1"
          onClick={() => src.loadDays(days)}
          data-testid="sim-load-days"
        >
          <History /> حمّل الأيام
        </Button>
        <Button variant="ghost" onClick={() => src.clearAll()} aria-label="امسح بيانات المحاكاة">
          <Trash2 /> امسح
        </Button>
      </div>
      <SwitchRow
        label="الجهاز الافتراضي شغّال"
        checked={hb}
        onCheckedChange={(v) => {
          setHb(v);
          src.setHeartbeat(v);
        }}
      />
    </Card>
  );
}
