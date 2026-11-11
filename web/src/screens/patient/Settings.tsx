import { Cloud, FlaskConical, LogOut, Usb, UserRound } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { SimPanel } from '@/components/kh/SimPanel';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardHint, CardTitle } from '@/components/ui/card';
import { ChoiceList } from '@/components/ui/segmented';
import { SwitchRow } from '@/components/ui/switch';
import type { SourceKind } from '@/data/DataSource';
import { DEFAULT_DEVICE_ID } from '@/data/firebase-config';
import { SerialSource, serialSupported } from '@/data/SerialSource';
import { toLatinDigits } from '@/lib/format';
import { MODE_AR, type Mode, modeAt } from '@/lib/level';
import { normalizeSaudiPhone } from '@/lib/whatsapp';
import { serverNow, useDevice, writeEvent } from '@/store/device';
import { useToday } from '@/store/selectors';
import { type Role, useSettings } from '@/store/settings';

const input =
  'min-h-touch w-full min-w-0 rounded-sm border-2 border-line bg-surface px-3 text-lg focus:border-brand-500';

function Section({
  id,
  title,
  hint,
  children,
}: {
  id: string;
  title: string;
  hint?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card id={id} className="grid scroll-mt-20 gap-3">
      <div>
        <CardTitle>{title}</CardTitle>
        {hint && <CardHint>{hint}</CardHint>}
      </div>
      {children}
    </Card>
  );
}

const MODE_HINT: Record<Mode, string> = {
  normal: 'قياس يومي قبل الوضوء.',
  travel: 'السجادة ما تنتظرك: فحص سريع يوميًا بدل القياس.',
  bandage: 'المقارنة بين القدمين متوقفة لأن الضماد يغيّر الحرارة.',
  hospital: 'لا تذكيرات ولا تصعيد أثناء التنويم.',
};

const ROLE_AR: Record<Role, string> = { patient: 'مريض', family: 'عائلة', clinic: 'عيادة' };

export function Settings() {
  const s = useSettings();
  const nav = useNavigate();
  const source = useDevice((d) => d.source);
  const conn = useDevice((d) => d.connection);
  const events = useDevice((d) => d.events);
  const today = useToday();
  const [dev, setDev] = useState(s.deviceId);
  const devValid = /^[a-z0-9-]{3,40}$/i.test(dev);
  const mode = modeAt(events, serverNow());
  const [modeErr, setModeErr] = useState('');
  const famPhoneOk = !s.familyPhone || normalizeSaudiPhone(s.familyPhone) !== null;
  const patient = s.role === 'patient';

  const setMode = async (m: Mode) => {
    setModeErr('');
    try {
      await writeEvent({ kind: 'mode', data: { mode: m }, day: today.key });
    } catch {
      setModeErr('ما قدرنا نحفظ الوضع. تأكد من الإنترنت.');
    }
  };

  return (
    <AppShell title="الإعدادات" back settings={false}>
      {patient && (
        <Section id="modes" title="وضع خاص" hint="يوقف التذكيرات والتصعيد مؤقتًا، وينكتب في السجل.">
          <ChoiceList<Mode>
            label="وضع خاص"
            value={mode}
            onChange={(v) => void setMode(v)}
            options={(['normal', 'travel', 'bandage', 'hospital'] as Mode[]).map((m) => ({
              value: m,
              label: MODE_AR[m],
              hint: MODE_HINT[m],
            }))}
          />
          {modeErr && <p className="text-base font-semibold text-lv-red-ink">{modeErr}</p>}
        </Section>
      )}

      {patient && (
        <Section id="family" title="جهة اتصال العائلة" hint="لزر واتساب في النتيجة. ما نرسل شي بدون ما تضغط.">
          <label className="grid gap-1">
            <span className="text-base">الاسم</span>
            <input
              className={input}
              value={s.familyName}
              onChange={(e) => s.set({ familyName: e.target.value })}
              placeholder="مثلًا: سعد"
            />
          </label>
          <label className="grid gap-1">
            <span className="text-base">رقم الجوال</span>
            <input
              className={input}
              dir="ltr"
              inputMode="tel"
              value={s.familyPhone}
              onChange={(e) => s.set({ familyPhone: toLatinDigits(e.target.value) })}
              placeholder="05XXXXXXXX"
              aria-invalid={!famPhoneOk}
              data-testid="family-phone"
            />
          </label>
          {!famPhoneOk && <p className="text-sm font-semibold text-lv-red-ink">اكتب رقم جوال سعودي صحيح.</p>}
          <label className="grid gap-1">
            <span className="text-base">اسمك في رسالة العائلة (اختياري)</span>
            <input
              className={input}
              value={s.patientName}
              onChange={(e) => s.set({ patientName: e.target.value })}
              placeholder="مثلًا: أبو سعد"
            />
          </label>
        </Section>
      )}

      {s.role === 'family' && (
        <Section id="patient" title="المريض اللي تتابعه" hint="لزر الاتصال وواتساب في واجهة العائلة.">
          <input
            className={input}
            value={s.patientName}
            onChange={(e) => s.set({ patientName: e.target.value })}
            placeholder="الاسم، مثلًا: أبو سعد"
            aria-label="اسم المريض"
          />
          <input
            className={input}
            dir="ltr"
            inputMode="tel"
            value={s.patientPhone}
            onChange={(e) => s.set({ patientPhone: toLatinDigits(e.target.value) })}
            placeholder="05XXXXXXXX"
          />
        </Section>
      )}

      {patient && (
        <Section
          id="reminder"
          title="التذكير اليومي"
          hint="داخل التطبيق. الإشعارات الحقيقية على الجوال: إصدار قادم."
        >
          <input
            type="time"
            className={input}
            dir="ltr"
            value={s.reminderTime}
            onChange={(e) => {
              s.set({ reminderTime: e.target.value });
              void writeEvent({ kind: 'reminder', data: { time: e.target.value }, day: today.key }).catch(
                () => {},
              );
            }}
            aria-label="وقت التذكير"
            data-testid="reminder-time"
          />
        </Section>
      )}

      <Section
        id="consents"
        title="الموافقات"
        hint="العيادة تستلم التنبيهات دائمًا لأن الخدمة ما تشتغل بدونها."
      >
        <SwitchRow
          label="حفظ صور القدم للعيادة"
          checked={s.consents.photos}
          onCheckedChange={(v) => s.set({ consents: { ...s.consents, photos: v } })}
        />
        <SwitchRow
          label="مشاركة التنبيهات مع العائلة"
          checked={s.consents.family}
          onCheckedChange={(v) => s.set({ consents: { ...s.consents, family: v } })}
        />
      </Section>

      {patient && (
        <Section id="voice" title="الصوت">
          <SwitchRow
            label="المساعد يقرأ الردود بصوت"
            checked={s.voice}
            onCheckedChange={(v) => s.set({ voice: v })}
          />
        </Section>
      )}

      <Section
        id="source"
        title="مصدر البيانات"
        hint="الشاشات نفسها مع أي مصدر. غير السجادة يظهر عليه شريط واضح."
      >
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
      </Section>

      {s.dataSource === 'simulation' && <SimPanel />}

      <Section id="demo" title="وضع العرض">
        <SwitchRow
          label="كل فحص = يوم"
          hint="للفيديو والعرض فقط: نوري قاعدة اليومين في دقائق. يظهر شريط على الشاشة."
          checked={s.demoMode}
          onCheckedChange={(v) => s.set({ demoMode: v, demoSince: v ? serverNow() : null })}
        />
      </Section>

      <Section
        id="device-id"
        title="رقم الجهاز"
        hint="غيّره للتجربة على جهاز ثاني بدون ما تخلط بيانات السجادة الحقيقية."
      >
        <div className="flex gap-2">
          <input
            dir="ltr"
            className={input}
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
      </Section>

      <Section
        id="account"
        title="الحساب"
        hint={s.session ? <>الدور الحالي: {s.role ? ROLE_AR[s.role] : '—'}</> : undefined}
      >
        <Button
          variant="secondary"
          size="lg"
          onClick={() => (s.set({ role: null }), nav('/', { replace: true }))}
          data-testid="change-role"
        >
          <UserRound /> غيّر الدور
        </Button>
        <Button
          variant="ghost"
          size="lg"
          onClick={() => (s.set({ session: null, role: null }), nav('/', { replace: true }))}
        >
          <LogOut /> سجّل خروج
        </Button>
      </Section>

      <Section id="about" title="عن خطوة">
        <div className="grid gap-2 text-base text-ink-2">
          <p>
            خطوة سجادة عند مكان الوضوء تقيس حرارة 4 نقاط في كل قدم وتطبّق قاعدة IWGDF: فرق أكبر من{' '}
            <bdi dir="ltr">2.2°</bdi> في نفس النقطة يومين متتاليين.
          </p>
          <p className="font-semibold text-ink">
            أداة مراقبة تساعد على الإحالة، مو تشخيص. النموذج ما اختُبر سريريًا.
          </p>
          <p>
            المساعد يرد بقوالب ثابتة مكتوبة مسبقًا، ولا يشخّص ولا يصف دواء. الذكاء الاصطناعي (Claude Haiku)
            يفهم كلام المريض الحر بس، ويحوّله لواحد من بلاغات ثابتة. الرد من القوالب، والقرار من القاعدة،
            والذكاء الاصطناعي ما يغيّر مستوى الخطر. واستُخدم Claude كذلك في كتابة أجزاء من الكود.
          </p>
          <p className="text-sm text-mute">
            فريق خطوة · MEDATHON 2026 · النسخة <span className="num">0.2.0</span> ·{' '}
            <a href="/legacy/" className="text-brand-700 underline">
              النموذج الأول
            </a>
          </p>
        </div>
      </Section>
    </AppShell>
  );
}
