import { Cpu, Lightbulb, Plug, Wifi, WifiOff } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Num } from '@/components/kh/Num';
import { SimPanel } from '@/components/kh/SimPanel';
import { AppShell } from '@/components/layout/AppShell';
import { Card, CardTitle } from '@/components/ui/card';
import { SerialSource } from '@/data/SerialSource';
import { useNow } from '@/hooks/useNow';
import { ago, arDate, clock } from '@/lib/format';
import { BUILD_STATUS_AR, matStatusAr } from '@/lib/words';
import { serverNow, useDevice } from '@/store/device';
import { useSettings } from '@/store/settings';

const SOURCE_AR = {
  firebase: 'السجادة عبر الإنترنت',
  simulation: 'محاكاة داخل المتصفح',
  serial: 'كابل USB',
  wokwi: 'السجادة الافتراضية (Wokwi)',
} as const;

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <div className="flex min-h-touch items-center justify-between gap-3 border-b border-line py-2 last:border-0">
      <dt className="text-base text-mute">{k}</dt>
      <dd className="text-end text-base font-semibold text-ink">{children}</dd>
    </div>
  );
}

export function Device() {
  useNow(5000);
  const status = useDevice((s) => s.status);
  const online = useDevice((s) => s.online);
  const scans = useDevice((s) => s.scans);
  const rejected = useDevice((s) => s.rejected);
  const source = useDevice((s) => s.source);
  const conn = useDevice((s) => s.connection);
  const kind = useSettings((s) => s.dataSource);
  const settingsId = useSettings((s) => s.deviceId);
  const deviceId = useDevice((s) => s.source?.deviceId) ?? settingsId;
  const last = scans.at(-1);
  const now = serverNow();

  return (
    <AppShell title="جهازي" back>
      <Card
        className={`flex items-center gap-4 border-2 ${online ? 'border-lv-green bg-lv-green-soft' : 'border-line-strong bg-lv-none-soft'}`}
        data-testid="device-status"
      >
        <span
          className={`grid size-14 place-items-center rounded-full text-white ${online ? 'bg-lv-green-ink' : 'bg-lv-none'}`}
        >
          {online ? <Wifi className="size-7" /> : <WifiOff className="size-7" />}
        </span>
        <div>
          <p className="text-2xl font-semibold text-ink" data-testid="device-online">
            {matStatusAr(kind, online)}
          </p>
          <p className="text-sm text-ink-2">
            {status?.lastSeen ? `آخر إشارة ${ago(now - status.lastSeen)}` : 'ما وصلت أي إشارة بعد'}
          </p>
        </div>
      </Card>

      <Card>
        <dl>
          <Row k="آخر قراءة">
            {last ? (
              <>
                {arDate(last.ts)} · <Num>{clock(last.ts)}</Num>
              </>
            ) : (
              'ما فيه'
            )}
          </Row>
          <Row k="نسخة البرنامج">{status?.firmware ? <Num>{status.firmware}</Num> : '—'}</Row>
          <Row k="مصدر البيانات">
            <Link to="/settings" className="text-brand-700 underline">
              {SOURCE_AR[kind]}
            </Link>
          </Row>
          <Row k="الجهاز يرسل من">
            {status?.source === 'esp32'
              ? kind === 'wokwi'
                ? 'كود ESP32 الحقيقي على دائرة افتراضية (Wokwi)'
                : 'السجادة الحقيقية'
              : status?.source === 'sim'
                ? 'محاكي'
                : '—'}
          </Row>
          <Row k="الجهاز">
            {/* Simulated data never shows a device id as if it were the real mat (honesty rule, as in the report) */}
            <span data-testid="device-id">
              {kind === 'simulation' ? (
                'جهاز محاكاة'
              ) : kind === 'wokwi' ? (
                'السجادة الافتراضية (Wokwi)'
              ) : (
                <Num>{deviceId}</Num>
              )}
            </span>
          </Row>
          {status?.rssi !== undefined && (
            <Row k="قوة الواي فاي">{status.rssi > -60 ? 'قوية' : status.rssi > -75 ? 'متوسطة' : 'ضعيفة'}</Row>
          )}
          <Row k="الاتصال بالخادم">
            {conn.connected && conn.ready ? 'متصل' : (conn.error ?? 'جارٍ الاتصال…')}
          </Row>
          {rejected.length > 0 && <Row k="قراءات مخالفة للشكل">{<Num>{rejected.length}</Num>}</Row>}
        </dl>
        {source instanceof SerialSource && source.lastRejected && (
          <p className="mt-2 rounded-sm bg-bg p-2 text-sm text-mute">
            آخر سطر غير مفهوم من USB: <bdi dir="ltr">{source.lastRejected}</bdi>
          </p>
        )}
      </Card>

      <Card className="grid gap-1 border-brand-300 bg-brand-50" data-testid="build-status">
        <CardTitle>حالة الجهاز</CardTitle>
        <p className="text-base text-ink">{BUILD_STATUS_AR}.</p>
        <p className="text-sm text-mute">
          في هذه النسخة: محاكاة داخل المتصفح، أو كود السجادة الحقيقي يشتغل على دائرة افتراضية (Wokwi).
        </p>
      </Card>

      <Card className="grid gap-3">
        <CardTitle>طريقة الوقوف</CardTitle>
        <ul className="grid gap-2 text-base text-ink">
          <li className="flex gap-2">
            <Plug className="size-5 shrink-0 text-brand-700" aria-hidden /> السجادة موصولة بالكهرباء وقريبة من
            الواي فاي.
          </li>
          <li className="flex gap-2">
            <Cpu className="size-5 shrink-0 text-brand-700" aria-hidden /> قف بالقدمين، كل كعب على مكانه،
            وقدمك ناشفة.
          </li>
          <li className="flex gap-2">
            <Lightbulb className="size-5 shrink-0 text-brand-700" aria-hidden /> الضوء الأخضر = تم. الأحمر =
            أعد الوقوف.
          </li>
        </ul>
        <p className="text-sm text-mute">إذا ظلت غير متصلة: افصل الكهرباء عنها وأرجعها، وانتظر دقيقة.</p>
      </Card>

      <SimPanel />
    </AppShell>
  );
}
