import * as SwitchPrimitive from '@radix-ui/react-switch';
import { useId, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Labelled switch row. The whole row is the touch target (≥48px). RTL-aware thumb. */
export function SwitchRow({
  label,
  hint,
  checked,
  onCheckedChange,
  disabled,
  testId,
}: {
  label: ReactNode;
  hint?: ReactNode;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  testId?: string;
}) {
  const id = useId();
  return (
    <div className="flex min-h-touch items-center justify-between gap-4 py-2">
      <label htmlFor={id} className="flex-1 cursor-pointer">
        <span className="block text-base text-ink">{label}</span>
        {hint && <span className="block text-sm text-mute">{hint}</span>}
      </label>
      <SwitchPrimitive.Root
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        disabled={disabled}
        data-testid={testId}
        className={cn(
          'relative h-8 w-14 shrink-0 rounded-full bg-line-strong transition-colors duration-kh',
          'data-[state=checked]:bg-brand-700 disabled:opacity-50',
        )}
      >
        <SwitchPrimitive.Thumb
          className={cn(
            // RTL: off = thumb on the right (start), on = thumb slides to the left (end).
            'absolute right-1 top-1 block size-6 rounded-full bg-white shadow transition-transform duration-kh ease-kh',
            'data-[state=checked]:-translate-x-6',
          )}
        />
      </SwitchPrimitive.Root>
    </div>
  );
}
