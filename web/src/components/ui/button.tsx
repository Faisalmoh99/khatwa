import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

/** Khatwa button. Minimum touch target 48px; `lg` is 60px for the one main action per screen. */
const buttonVariants = cva(
  'inline-flex select-none items-center justify-center gap-2 whitespace-nowrap rounded font-semibold transition-[background-color,box-shadow,transform] duration-kh ease-kh active:scale-[.98] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-5 [&_svg]:shrink-0',
  {
    variants: {
      variant: {
        primary: 'bg-brand-700 text-white shadow-card hover:bg-brand-600',
        secondary: 'border-2 border-brand-700 bg-surface text-brand-700 hover:bg-brand-50',
        soft: 'bg-brand-100 text-brand-900 hover:bg-brand-50',
        ghost: 'text-brand-700 hover:bg-brand-50',
        danger: 'bg-lv-red-ink text-white hover:brightness-110',
        whatsapp: 'bg-[#1a7f4b] text-white hover:brightness-110',
      },
      size: {
        md: 'min-h-touch px-5 text-base',
        lg: 'min-h-touch-lg px-6 text-lg',
        icon: 'size-12 min-h-touch',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, block, asChild, type, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : (type ?? 'button')}
        className={cn(buttonVariants({ variant, size, block }), className)}
        {...props}
      />
    );
  },
);
Button.displayName = 'Button';
