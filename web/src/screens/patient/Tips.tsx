import { Droplets, Footprints, Scissors, ShoppingBag, Sun } from 'lucide-react';
import type { ReactNode } from 'react';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/card';

/** General foot-care tips (from the prototype). Not a substitute for the care team. */
const TIPS: { title: string; body: string; icon: ReactNode }[] = [
  {
    title: 'العناية اليومية',
    icon: <Footprints />,
    body: 'افحص قدميك كل يوم: باطن القدم وبين الأصابع. اغسلهما بماء فاتر ونشّفهما كويس، خصوصًا بين الأصابع، ثم رطّب الجلد بس مو بين الأصابع.',
  },
  {
    title: 'الحذاء والجوارب',
    icon: <ShoppingBag />,
    body: 'لا تمشِ حافي حتى في البيت. افحص داخل الحذاء قبل ما تلبسه، واختر حذاء واسع ومريح وجوارب قطنية بدون خياطات بارزة. جرّب الأحذية الجديدة آخر النهار.',
  },
  {
    title: 'أيام الحر',
    icon: <Sun />,
    body: 'الأرض والرمل والأسفلت ممكن تحرق القدم بدون ما تحس. لا تمشِ على أرض حارة، واختبر ماء الاستحمام بمرفقك مو بقدمك، وأكثر من الماء.',
  },
  {
    title: 'بعد الوضوء',
    icon: <Droplets />,
    body: 'قِس على السجادة قبل الوضوء. وبعد الوضوء نشّف قدميك كويس بمنشفة ناعمة، وانتبه لما بين الأصابع.',
  },
  {
    title: 'الأظافر والجلد',
    icon: <Scissors />,
    body: 'قصّ الأظافر بشكل مستقيم، ولا تقطع الجلد الميت بنفسك. أي شق أو فقاعة أو تغيّر لون، بلّغ فريقك الطبي بدون ما تنتظر.',
  },
];

export function Tips() {
  return (
    <AppShell title="نصائح العناية" back>
      <p className="text-base text-ink-2">نصائح عامة، ما تغني عن توجيه فريقك الطبي.</p>
      {TIPS.map((t) => (
        <Card key={t.title} className="flex gap-4" data-testid="tip">
          <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700 [&_svg]:size-6">
            {t.icon}
          </span>
          <div>
            <h2 className="text-lg font-semibold text-ink">{t.title}</h2>
            <p className="text-base text-ink-2">{t.body}</p>
          </div>
        </Card>
      ))}
    </AppShell>
  );
}
