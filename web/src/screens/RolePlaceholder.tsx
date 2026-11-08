import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/card';

/** Temporary until phase 3 builds the family and clinic views. */
export function RolePlaceholder({ role }: { role: 'family' | 'clinic' }) {
  return (
    <AppShell title={role === 'family' ? 'العائلة' : 'العيادة'}>
      <Card>
        <p className="text-lg">هذي الواجهة تنبني في المرحلة 3.</p>
      </Card>
    </AppShell>
  );
}
