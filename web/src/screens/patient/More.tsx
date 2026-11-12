import {
  CalendarPlus,
  Camera,
  ChevronLeft,
  ClipboardCheck,
  Cpu,
  FileText,
  HeartPulse,
  Rocket,
  Settings,
  type LucideIcon,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { PATIENT_NAV } from '@/components/layout/navs';
import { AppShell } from '@/components/layout/AppShell';

interface MoreItem {
  to: string;
  label: string;
  hint: string;
  icon: LucideIcon;
}

/** Secondary destinations. Each phase adds its screens here. */
const MORE_ITEMS: MoreItem[] = [
  { to: '/quick', label: 'الفحص السريع', hint: 'ثلاث أسئلة بدل القياس', icon: ClipboardCheck },
  { to: '/report', label: 'تقرير الزيارة', hint: 'للطبيب، مع QR وطباعة', icon: FileText },
  { to: '/booking', label: 'حجز موعد', hint: 'طلب موعد (تجريبي)', icon: CalendarPlus },
  { to: '/photo', label: 'تصوير القدم', hint: 'صورة للعيادة، بدون تحليل', icon: Camera },
  { to: '/tips', label: 'نصائح العناية', hint: 'العناية اليومية بالقدم', icon: HeartPulse },
  { to: '/device', label: 'جهازي', hint: 'حالة السجادة وطريقة الوقوف', icon: Cpu },
  { to: '/coming-soon', label: 'قادم قريبًا', hint: 'ميزات نخطط لها', icon: Rocket },
  { to: '/settings', label: 'الإعدادات', hint: 'العائلة، التذكير، الموافقات', icon: Settings },
];

export function More() {
  return (
    <AppShell title="المزيد" nav={PATIENT_NAV}>
      <ul className="grid gap-2">
        {MORE_ITEMS.map(({ to, label, hint, icon: Icon }) => (
          <li key={to}>
            <Link
              to={to}
              className="flex min-h-[72px] items-center gap-4 rounded border border-line bg-surface px-4 shadow-card active:bg-brand-50"
            >
              <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700">
                <Icon className="size-6" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-lg font-semibold text-ink">{label}</span>
                <span className="block truncate text-sm text-mute">{hint}</span>
              </span>
              <ChevronLeft className="size-6 text-mute" aria-hidden />
            </Link>
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
