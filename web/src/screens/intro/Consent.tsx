import { Building2, Camera, Database, HeartHandshake, ShieldCheck } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SwitchRow } from '@/components/ui/switch';
import { useSettings } from '@/store/settings';

function Row({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="mt-1 grid size-10 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700 [&_svg]:size-5">
        {icon}
      </span>
      <div>
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        <p className="text-sm text-ink-2">{children}</p>
      </div>
    </div>
  );
}

/** Consent and privacy (Saudi PDPL spirit): what we collect, who sees it, separate opt-ins. */
export function Consent() {
  const s = useSettings();
  const nav = useNavigate();
  const [core, setCore] = useState(s.consents.core);
  const [photos, setPhotos] = useState(s.consents.photos);
  const [family, setFamily] = useState(s.consents.family);

  return (
    <div className="mx-auto grid max-w-screen-sm gap-4 px-4 pb-8 pt-6">
      <div className="grid gap-2">
        <span className="grid size-14 place-items-center rounded-full bg-brand-700 text-white">
          <ShieldCheck className="size-7" />
        </span>
        <h1 className="text-2xl font-semibold text-brand-900">بياناتك وخصوصيتك</h1>
        <p className="text-base text-ink-2">
          قبل ما نبدأ، هذا اللي نجمعه ومين يشوفه. تقدر تغيّر موافقتك أي وقت من الإعدادات.
        </p>
      </div>

      <Card className="grid gap-4">
        <Row icon={<Database />} title="وش نجمع">
          حرارة 4 نقاط في كل قدم، وهل وقفت صح، وإجاباتك في الفحص السريع، ورسائلك للمساعد.
        </Row>
        <Row icon={<Building2 />} title="مين يشوفها">
          أنت والعيادة اللي تتابعك. العائلة ما تشوف شي إلا إذا وافقت تحت.
        </Row>
        <Row icon={<ShieldCheck />} title="وين تنحفظ">
          في هذي النسخة التجريبية تنحفظ في Firebase (خوادم في أوروبا). التشغيل الحقيقي يحتاج تخزين داخل
          المملكة ومراجعة حسب نظام حماية البيانات الشخصية.
        </Row>
      </Card>

      <Card className="grid gap-1 divide-y divide-line">
        <SwitchRow
          label="أوافق على جمع بيانات القياس ومشاركتها مع العيادة"
          hint="مطلوبة عشان الخدمة تشتغل"
          checked={core}
          onCheckedChange={setCore}
        />
        <SwitchRow
          label={
            <span className="inline-flex items-center gap-2">
              <Camera className="size-5 text-brand-700" aria-hidden /> حفظ صور القدم للعيادة
            </span>
          }
          hint="اختياري. الصورة تنرفع بإرادتك فقط، وما نحللها."
          checked={photos}
          onCheckedChange={setPhotos}
        />
        <SwitchRow
          label={
            <span className="inline-flex items-center gap-2">
              <HeartHandshake className="size-5 text-brand-700" aria-hidden /> مشاركة التنبيهات مع العائلة
            </span>
          }
          hint="اختياري. نرسل لهم إذا احتجت متابعة أو ما قست يومين."
          checked={family}
          onCheckedChange={setFamily}
        />
      </Card>

      <Button
        size="lg"
        block
        disabled={!core}
        data-testid="consent-accept"
        onClick={() => {
          s.set({ consents: { core, photos, family, acceptedAt: Date.now() } });
          nav('/', { replace: true });
        }}
      >
        أوافق وأكمل
      </Button>
      {!core && <p className="text-center text-sm text-mute">لازم توافق على الأولى عشان تكمل.</p>}
    </div>
  );
}
