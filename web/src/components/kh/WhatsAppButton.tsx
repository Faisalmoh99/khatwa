import { MessageCircleMore } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import type { DayView } from '@/lib/level';
import { familyMessage, sendLabel, whatsappLink } from '@/lib/whatsapp';
import { useSettings } from '@/store/settings';

/** Opens WhatsApp with a ready message to the family contact. Respects the family consent. */
export function WhatsAppButton({
  view,
  block = true,
}: {
  view: Pick<DayView, 'level' | 'reasons'>;
  block?: boolean;
}) {
  const consent = useSettings((s) => s.consents.family);
  const phone = useSettings((s) => s.familyPhone);
  const name = useSettings((s) => s.familyName);
  const patient = useSettings((s) => s.patientName);
  if (!consent)
    return (
      <p className="text-sm text-mute">
        مشاركة العائلة غير مفعّلة.{' '}
        <Link to="/settings#consents" className="font-semibold text-brand-700 underline">
          فعّلها من الإعدادات
        </Link>
      </p>
    );
  const href = whatsappLink(phone, familyMessage(view, patient));
  return (
    <div className="grid gap-1">
      <Button variant="whatsapp" size="lg" block={block} asChild>
        <a href={href} target="_blank" rel="noopener noreferrer" data-testid="wa-family">
          <MessageCircleMore /> {sendLabel(name)}
        </a>
      </Button>
      {!phone && (
        <p className="text-sm text-mute">
          ما حفظت رقم العائلة، بتختار المحادثة بنفسك.{' '}
          <Link to="/settings#family" className="font-semibold text-brand-700 underline">
            أضف الرقم
          </Link>
        </p>
      )}
    </div>
  );
}
