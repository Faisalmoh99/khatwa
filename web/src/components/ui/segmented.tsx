import * as RadioGroup from '@radix-ui/react-radio-group';
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Large single-choice list (radio cards). Better than a dropdown for older users. */
export function ChoiceList<T extends string>({
  value,
  onChange,
  options,
  label,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: ReactNode; hint?: ReactNode; icon?: ReactNode; disabled?: boolean }[];
  label: string;
}) {
  return (
    <RadioGroup.Root
      aria-label={label}
      value={value}
      onValueChange={(v) => onChange(v as T)}
      className="grid gap-2"
      dir="rtl"
    >
      {options.map((o) => (
        <RadioGroup.Item
          key={o.value}
          value={o.value}
          disabled={o.disabled}
          className={cn(
            'flex min-h-touch-lg w-full items-center gap-3 rounded border-2 border-line bg-surface px-4 py-2 text-start transition-colors duration-kh',
            'data-[state=checked]:border-brand-700 data-[state=checked]:bg-brand-50 disabled:opacity-50',
          )}
        >
          {o.icon && <span className="text-brand-700 [&_svg]:size-6">{o.icon}</span>}
          <span className="flex-1">
            <span className="block text-base font-semibold text-ink">{o.label}</span>
            {o.hint && <span className="block text-sm text-mute">{o.hint}</span>}
          </span>
          <span className="grid size-6 shrink-0 place-items-center rounded-full border-2 border-line-strong">
            <RadioGroup.Indicator className="size-3 rounded-full bg-brand-700" />
          </span>
        </RadioGroup.Item>
      ))}
    </RadioGroup.Root>
  );
}
