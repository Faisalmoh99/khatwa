import { Bell, Cpu, Droplet, Footprints, ScanSearch } from 'lucide-react';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/card';

/** Planned features. Shown honestly: no numbers, no logic behind them, nothing that changes a level. */
const SOON: { title: string; body: string; icon: ReactNode }[] = [
  {
    title: 'قياس التروية',
    icon: <Droplet />,
    body: 'قياس تدفق الدم في القدم. ما عندنا حساس له في هذي النسخة.',
  },
  {
    title: 'خريطة الضغط',
    icon: <Footprints />,
    body: 'توزيع الضغط على كامل القدم. الحساس الحالي تحت الكعب يتأكد من الوقوف بس.',
  },
  {
    title: 'تحليل الصورة بالذكاء الاصطناعي',
    icon: <ScanSearch />,
    body: 'الصور الحين تنحفظ للعيادة تشوفها بنفسها، بدون أي تحليل.',
  },
  {
    title: 'إشعارات حقيقية على الجوال',
    icon: <Bell />,
    body: 'تذكير وتنبيه يوصل حتى لو التطبيق مقفل. الحين التذكير داخل التطبيق.',
  },
  { title: 'حساسات حرارة طبية (TMP117)', icon: <Cpu />, body: 'ترقية الحساسات لنوع طبي أدق.' },
];

export function ComingSoon() {
  return (
    <AppShell title="قادم قريبًا" back>
      <p className="text-base text-ink-2">هذي ميزات نخطط لها. ما هي موجودة في هذي النسخة.</p>
      {SOON.map((s) => (
        <Card key={s.title} className="flex gap-4" data-testid="soon">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-lv-none-soft text-lv-none-ink [&_svg]:size-6">
            {s.icon}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-ink">{s.title}</h2>
              <span className="rounded-full bg-lv-none-soft px-2 py-0.5 text-xs font-semibold text-lv-none-ink">
                إصدار قادم
              </span>
            </div>
            <p className="text-base text-ink-2">{s.body}</p>
          </div>
        </Card>
      ))}
    </AppShell>
  );
}
