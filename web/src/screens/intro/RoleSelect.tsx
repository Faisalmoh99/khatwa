import { Building2, ChevronLeft, HeartHandshake, User } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { type Role, useSettings } from '@/store/settings';

const ROLES: { role: Role; title: string; hint: string; icon: ReactNode }[] = [
  { role: 'patient', title: 'مريض', hint: 'أقيس قدمي كل يوم وأشوف النتيجة', icon: <User /> },
  { role: 'family', title: 'عائلة', hint: 'أتابع حالة قريبي وتوصلني التنبيهات', icon: <HeartHandshake /> },
  { role: 'clinic', title: 'عيادة', hint: 'أتابع المرضى والتنبيهات والتقارير', icon: <Building2 /> },
];

export function RoleSelect() {
  const set = useSettings((s) => s.set);
  const nav = useNavigate();
  return (
    <div className="mx-auto grid max-w-screen-sm gap-5 px-5 pt-10">
      <div className="grid gap-2">
        <h1 className="text-2xl font-semibold text-brand-900">مين أنت؟</h1>
        <p className="text-base text-ink-2">اختر طريقة استخدامك للتطبيق. تقدر تغيّرها من الإعدادات.</p>
      </div>
      <div className="grid gap-3">
        {ROLES.map((r) => (
          <button
            key={r.role}
            type="button"
            data-testid={`role-${r.role}`}
            onClick={() => {
              set({ role: r.role });
              nav('/', { replace: true });
            }}
            className="flex min-h-[88px] items-center gap-4 rounded border-2 border-line bg-surface px-4 text-start shadow-card transition-colors duration-kh hover:border-brand-500 active:bg-brand-50"
          >
            <span className="grid size-14 shrink-0 place-items-center rounded-full bg-brand-100 text-brand-700 [&_svg]:size-7">
              {r.icon}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-xl font-semibold text-ink">{r.title}</span>
              <span className="block text-sm text-mute">{r.hint}</span>
            </span>
            <ChevronLeft className="size-6 text-mute" aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}
