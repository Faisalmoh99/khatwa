import { Wifi, WifiOff } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/cn';
import { useDevice } from '@/store/device';

/** Small device status pill linking to "My device". */
export function DeviceChip({ className }: { className?: string }) {
  const online = useDevice((s) => s.online);
  return (
    <Link
      to="/device"
      className={cn(
        'inline-flex min-h-touch items-center gap-2 rounded-full border px-4 text-sm font-semibold',
        online
          ? 'border-lv-green bg-lv-green-soft text-lv-green-ink'
          : 'border-line-strong bg-surface text-mute',
        className,
      )}
      data-testid="device-chip"
    >
      {online ? <Wifi className="size-4" aria-hidden /> : <WifiOff className="size-4" aria-hidden />}
      {online ? 'السجادة متصلة' : 'السجادة غير متصلة'}
    </Link>
  );
}
