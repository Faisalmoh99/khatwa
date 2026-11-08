import { Cloud, FlaskConical, Usb } from 'lucide-react';
import { useState } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardHint, CardTitle } from '@/components/ui/card';
import { ChoiceList } from '@/components/ui/segmented';
import { SwitchRow } from '@/components/ui/switch';
import type { SourceKind } from '@/data/DataSource';
import { DEFAULT_DEVICE_ID } from '@/data/firebase-config';
import { SerialSource, serialSupported } from '@/data/SerialSource';
import { serverNow, useDevice } from '@/store/device';
import { useSettings } from '@/store/settings';

export function Settings() {
  const s = useSettings();
  const source = useDevice((d) => d.source);
  const conn = useDevice((d) => d.connection);
  const [dev, setDev] = useState(s.deviceId);
  const devValid = /^[a-z0-9-]{3,40}$/i.test(dev);

  return (
    <AppShell title="الإعدادات">
      <Card className="grid gap-3">
        <div>
          <CardTitle>مصدر البيانات</CardTitle>
          <CardHint>الشاشات نفسها تشتغل مع أي مصدر. غير الجهاز الحقيقي يظهر عليه شريط واضح.</CardHint>
        </div>
        <ChoiceList<SourceKind>
          label="مصدر البيانات"
          value={s.dataSource}
          onChange={(v) => s.set({ dataSource: v })}
          options={[
            {
              value: 'firebase',
              label: 'السجادة (الإنترنت)',
              hint: 'الجهاز الحقيقي عبر Firebase',
              icon: <Cloud />,
            },
            {
              value: 'simulation',
              label: 'محاكاة',
              hint: 'سيناريوهات داخل المتصفح بدون إنترنت',
              icon: <FlaskConical />,
            },
            {
              value: 'serial',
              label: 'كابل USB',
              hint: serialSupported()
                ? 'احتياط لو النت خرب (كروم على الكمبيوتر أو أندرويد)'
                : 'المتصفح هذا ما يدعم USB',
              icon: <Usb />,
              disabled: !serialSupported(),
            },
          ]}
        />
        {source instanceof SerialSource && (
          <Button onClick={() => void source.connect()} variant="secondary" size="lg">
            <Usb /> {conn.connected ? 'متصل بالسجادة' : 'اختر منفذ السجادة'}
          </Button>
        )}
      </Card>

      <Card className="grid gap-2">
        <CardTitle>وضع العرض</CardTitle>
        <SwitchRow
          label="كل فحص = يوم"
          hint="للفيديو والعرض فقط: نوري قاعدة اليومين في دقائق. يظهر على الشاشة."
          checked={s.demoMode}
          onCheckedChange={(v) => s.set({ demoMode: v, demoSince: v ? serverNow() : null })}
        />
      </Card>

      <Card className="grid gap-2">
        <CardTitle>رقم الجهاز</CardTitle>
        <CardHint>غيّره لو تبي تجرّب على جهاز ثاني بدون ما تخلط بيانات السجادة الحقيقية.</CardHint>
        <div className="flex gap-2">
          <input
            dir="ltr"
            className="min-h-touch flex-1 rounded-sm border-2 border-line bg-surface px-3 text-base"
            value={dev}
            onChange={(e) => setDev(e.target.value.trim())}
            aria-label="رقم الجهاز"
            aria-invalid={!devValid}
          />
          <Button disabled={!devValid || dev === s.deviceId} onClick={() => s.set({ deviceId: dev })}>
            حفظ
          </Button>
        </div>
        {s.deviceId !== DEFAULT_DEVICE_ID && (
          <Button
            variant="ghost"
            onClick={() => (setDev(DEFAULT_DEVICE_ID), s.set({ deviceId: DEFAULT_DEVICE_ID }))}
          >
            رجّع للجهاز الأساسي ({DEFAULT_DEVICE_ID})
          </Button>
        )}
      </Card>
    </AppShell>
  );
}
