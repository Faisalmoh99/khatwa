import { CheckCheck, MessageCircleMore, Phone } from 'lucide-react';
import { writeErrorAr } from '@/data/DataSource';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { EventList } from '@/components/kh/EventList';
import { LevelHero } from '@/components/kh/LevelHero';
import { AppShell } from '@/components/layout/AppShell';
import { Button } from '@/components/ui/button';
import { Card, CardHint, CardTitle } from '@/components/ui/card';
import { ladderText } from '@/lib/ladder';
import { ago } from '@/lib/format';
import { familyEmptyText, matStatusAr } from '@/lib/words';
import { telLink, whatsappLink } from '@/lib/whatsapp';
import { serverNow, useDevice, writeEvent } from '@/store/device';
import { useRealPatient } from '@/store/patients';
import { useSettings } from '@/store/settings';

/** Family view: the patient's state, the alerts sent to the family, call and WhatsApp. */
export function FamilyHome() {
  const p = useRealPatient();
  const online = useDevice((s) => s.online);
  const kind = useSettings((s) => s.dataSource);
  const phone = useSettings((s) => s.patientPhone);
  const [acked, setAcked] = useState(false);
  const [ackErr, setAckErr] = useState('');
  const last = p.scans.at(-1);
  const alerts = [...p.events]
    .reverse()
    .filter(
      (e) =>
        (e.kind === 'escalation' && (e.data as { to?: string })?.to === 'family') ||
        e.kind === 'redflag' ||
        e.kind === 'mode',
    )
    .slice(0, 10);
  const tel = telLink(phone);
  const wa = whatsappLink(phone, 'السلام عليكم، شفت تنبيه خطوة. كيف حالك وكيف قدمك اليوم؟');

  return (
    <AppShell title="العائلة">
      <p className="text-base text-ink-2">
        تتابع: <b className="text-ink">{p.name}</b>
      </p>
      <LevelHero level={p.today.level} reason={p.today.reasons[0]?.ar} testId="family-hero" />

      <Card className="grid gap-1">
        <p className="text-base text-ink">{ladderText(p.ladder, 'other')}</p>
        <p className="text-sm text-mute">
          آخر قياس: {last ? ago(serverNow() - last.ts) : 'ما فيه'} · {matStatusAr(kind, online)}
        </p>
      </Card>

      <div className="grid grid-cols-2 gap-3">
        {tel ? (
          <Button size="lg" asChild>
            <a href={tel} data-testid="family-call">
              <Phone /> اتصل
            </a>
          </Button>
        ) : (
          <Button size="lg" asChild variant="secondary">
            <Link to="/settings#patient">
              <Phone /> أضف رقمه
            </Link>
          </Button>
        )}
        <Button size="lg" variant="whatsapp" asChild>
          <a href={wa} target="_blank" rel="noopener noreferrer" data-testid="family-wa">
            <MessageCircleMore /> واتساب
          </a>
        </Button>
      </div>
      <Button
        size="lg"
        variant="secondary"
        disabled={acked}
        onClick={() =>
          void writeEvent({ kind: 'family_ack', data: {} }).then(
            () => (setAcked(true), setAckErr('')),
            (e: unknown) => setAckErr(writeErrorAr(e)),
          )
        }
        data-testid="family-ack"
      >
        <CheckCheck /> {acked ? 'سجّلنا إنك تواصلت معه' : 'تواصلت معه'}
      </Button>
      {ackErr && (
        <p className="text-base font-semibold text-lv-red-ink" role="alert" data-testid="ack-error">
          {ackErr}
        </p>
      )}

      <Card className="grid gap-2">
        <CardTitle>التنبيهات</CardTitle>
        <CardHint>اللي وصلك من خطوة عن قريبك.</CardHint>
        <EventList events={alerts} empty={familyEmptyText(p.today.level)} />
      </Card>
      <p className="text-center text-sm text-mute">خطوة أداة مراقبة تساعد على الإحالة، مو تشخيص.</p>
    </AppShell>
  );
}
