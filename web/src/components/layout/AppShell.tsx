import { Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ConnectionBanner, SourceBanner } from '@/components/kh/Banners';

export function TopBar({ title, end }: { title?: string; end?: ReactNode }) {
  const loc = useLocation();
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-screen-sm items-center gap-3 px-4">
        <Link to="/" className="flex items-center gap-2" aria-label="خطوة، الرئيسية">
          <img src="/logo.png" alt="" width={36} height={36} className="rounded-sm" />
          <span className="text-xl font-semibold text-brand-900">{title ?? 'خطوة'}</span>
        </Link>
        <div className="ms-auto flex items-center gap-1">
          {end}
          {loc.pathname !== '/settings' && (
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

export function AppShell({ children, title, end }: { children: ReactNode; title?: string; end?: ReactNode }) {
  return (
    <div className="min-h-dvh pb-[env(safe-area-inset-bottom)]">
      <SourceBanner />
      <ConnectionBanner />
      <TopBar title={title} end={end} />
      <main className="mx-auto grid max-w-screen-sm gap-4 px-4 py-4 [&>*]:min-w-0">{children}</main>
    </div>
  );
}
