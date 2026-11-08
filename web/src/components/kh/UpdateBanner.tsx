import { RefreshCw } from 'lucide-react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '@/components/ui/button';

/** Offline app shell + "update available" prompt (the service worker never swaps silently mid-use). */
export function UpdateBanner() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({ immediate: true });
  if (!needRefresh) return null;
  return (
    <div
      className="fixed inset-x-3 bottom-[calc(72px+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-screen-sm items-center gap-3 rounded border border-brand-300 bg-surface p-3 shadow-lift print:hidden"
      role="status"
    >
      <RefreshCw className="size-6 shrink-0 text-brand-700" aria-hidden />
      <p className="flex-1 text-base font-semibold text-ink">فيه تحديث جديد للتطبيق.</p>
      <Button size="md" onClick={() => void updateServiceWorker(true)}>
        حدّث
      </Button>
      <Button size="md" variant="ghost" onClick={() => setNeedRefresh(false)}>
        لاحقًا
      </Button>
    </div>
  );
}
