import { Cpu, Eye, FlaskConical, RefreshCw, Usb, WifiOff } from 'lucide-react';
import { useDelayed } from '@/hooks/useNow';
import { useDevice } from '@/store/device';
import { useSettings } from '@/store/settings';

/**
 * Always visible, on every screen, unless this is the patient's own phone on the real mat (honesty rule).
 * Says where the data comes from: simulation, the virtual Wokwi mat, USB, or the real mat read-only.
 */
export function SourceBanner() {
  const kind = useSettings((s) => s.dataSource);
  const demo = useSettings((s) => s.demoMode);
  const patientDevice = useSettings((s) => s.patientDevice);
  const readOnly = kind === 'firebase' && !patientDevice;
  if (kind === 'firebase' && !demo && !readOnly) return null;
  return (
    <div
      className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1 bg-brand-900 px-4 py-1.5 text-center text-sm font-semibold text-white"
      role="status"
      data-testid="source-banner"
      data-source={kind}
    >
      {kind === 'simulation' && (
        <span className="inline-flex items-center gap-1.5">
          <FlaskConical className="size-4 shrink-0" aria-hidden /> نسخة عرض: بيانات محاكاة. الجهاز المادي
          يُبنى للنهائيات
        </span>
      )}
      {kind === 'wokwi' && (
        <span className="inline-flex items-center gap-1.5">
          <Cpu className="size-4 shrink-0" aria-hidden /> متصل بالسجادة الافتراضية (Wokwi)
        </span>
      )}
      {kind === 'serial' && (
        <span className="inline-flex items-center gap-1.5">
          <Usb className="size-4" aria-hidden /> متصل بـ USB
        </span>
      )}
      {readOnly && (
        <span className="inline-flex items-center gap-1.5">
          <Eye className="size-4" aria-hidden /> السجادة: مشاهدة فقط، ما نحفظ شي من هذا الجوال
        </span>
      )}
      {demo && <span>وضع العرض: كل فحص = يوم</span>}
    </div>
  );
}

/** "No connection" from Firebase `.info/connected`, with automatic retry. */
export function ConnectionBanner() {
  const kind = useSettings((s) => s.dataSource);
  const c = useDevice((s) => s.connection);
  const cached = useDevice((s) => s.fromCache);
  const down = (kind === 'firebase' || kind === 'wokwi') && !(c.connected && c.ready);
  const show = useDelayed(down, 1500);
  if (!show) return null;
  const starting = !c.connected && !c.ready && !c.error && !c.retrying;
  return (
    <div
      className="flex items-center justify-center gap-2 bg-lv-yellow-soft px-4 py-2 text-sm font-semibold text-lv-yellow-ink"
      role="status"
      aria-live="polite"
    >
      {starting ? (
        <RefreshCw className="size-4 animate-spin" aria-hidden />
      ) : (
        <WifiOff className="size-4" aria-hidden />
      )}
      {starting
        ? cached
          ? 'جارٍ الاتصال… نعرض آخر بيانات محفوظة'
          : 'جارٍ الاتصال…'
        : cached
          ? 'لا يوجد اتصال. نعرض آخر بيانات محفوظة، ونحاول تلقائيًا.'
          : (c.error ?? 'لا يوجد اتصال. نحاول مرة ثانية تلقائيًا…')}
    </div>
  );
}
