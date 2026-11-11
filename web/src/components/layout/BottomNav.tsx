import type { LucideIcon } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { cn } from '@/lib/cn';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

/** Large bottom tabs: icon + always-visible label, ≥ 60px tall. */
export function BottomNav({ items }: { items: NavItem[] }) {
  return (
    <nav
      aria-label="التنقل الرئيسي"
      className="fixed inset-x-0 bottom-0 z-30 print:hidden border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_12px_rgba(0,0,0,0.06)]"
    >
      <ul
        className="mx-auto grid max-w-screen-sm"
        style={{ gridTemplateColumns: `repeat(${items.length}, minmax(0, 1fr))` }}
      >
        {items.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex min-h-touch-lg flex-col items-center justify-center gap-0.5 px-1 text-[13px] font-semibold transition-colors duration-kh',
                  isActive ? 'text-brand-700' : 'text-mute hover:text-brand-600',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      'grid h-8 w-14 place-items-center rounded-full transition-colors duration-kh',
                      isActive && 'bg-brand-100',
                    )}
                  >
                    <Icon className="size-6" strokeWidth={isActive ? 2.4 : 2} aria-hidden />
                  </span>
                  <span className="truncate">{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
