import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/cn';

export function Card({ className, ...p }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('rounded border border-line bg-surface p-4 shadow-card', className)} {...p} />;
}

export function CardTitle({ className, ...p }: HTMLAttributes<HTMLHeadingElement>) {
  return <h2 className={cn('text-lg font-semibold text-ink', className)} {...p} />;
}

export function CardHint({ className, ...p }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-sm text-mute', className)} {...p} />;
}
