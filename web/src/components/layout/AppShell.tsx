import { ChevronRight, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ConnectionBanner, SourceBanner } from '@/components/kh/Banners';
import { cn } from '@/lib/cn';
import { BottomNav, type NavItem } from './BottomNav';

export function TopBar({
  title,
  back,
  end,
  settings = true,
}: {
  title?: string;
  back?: boolean | string;
  end?: ReactNode;
  settings?: boolean;
}) {
  const nav = useNavigate();
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur print:hidden">
      <div className="mx-auto flex h-16 max-w-screen-sm items-center gap-2 px-3">
        {back ? (
          <button
            type="button"
            onClick={() => (typeof back === 'string' ? nav(back) : nav(-1))}
            aria-label="رجوع"
            className="grid size-12 place-items-center rounded-full text-brand-700 hover:bg-brand-50"
          >
            <ChevronRight className="size-7" />
          </button>
        ) : (
          <img src="/logo.png" alt="" width={36} height={36} className="ms-1 rounded-sm" />
        )}
        <h1 className="truncate text-xl font-semibold text-brand-900">{title ?? 'خطوة'}</h1>
        <div className="ms-auto flex items-center gap-1">
          {end}
          {settings && (
            <Link
              to="/settings"
              aria-label="الإعدادات"
              className="grid size-12 place-items-center rounded-full text-brand-700 hover:bg-brand-50"
            >
              <Settings className="size-6" />
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

/** Page frame: honesty banners, top bar, content, optional bottom navigation. */
export function AppShell({
  children,
  title,
  back,
  end,
  nav,
  settings,
  className,
}: {
  children: ReactNode;
  title?: string;
  back?: boolean | string;
  end?: ReactNode;
  nav?: NavItem[] | null;
  settings?: boolean;
  className?: string;
}) {
  return (
    <div className="min-h-dvh">
      <div className="print:hidden">
        <SourceBanner />
        <ConnectionBanner />
      </div>
      <TopBar title={title} back={back} end={end} settings={settings} />
      <main
        className={cn(
          'mx-auto grid max-w-screen-sm gap-4 px-4 py-4 [&>*]:min-w-0',
          nav && 'pb-28',
          className,
        )}
      >
        {children}
      </main>
      {nav && <BottomNav items={nav} />}
    </div>
  );
}
