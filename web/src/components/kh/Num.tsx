import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

/** Number isolated left-to-right inside Arabic text, so "-1.2°" never renders as "1.2°-". */
export function Num({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <bdi dir="ltr" className={cn('num', className)}>
      {children}
    </bdi>
  );
}
