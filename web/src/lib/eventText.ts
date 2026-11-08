/** Human-readable audit lines for events (clinic audit log, family alerts). Text only, never HTML. */
import type { KhEvent } from '@/data/types';
import { RECIPIENT_AR, REASON_AR, type Recipient, type EscReason } from './escalations';
import { MODE_AR, type Mode } from './level';

export interface EventLine {
  title: string;
  to: string;
  why: string;
  tone: 'urgent' | 'warn' | 'info';
}

const str = (v: unknown) => (typeof v === 'string' ? v : v === undefined || v === null ? '' : String(v));
const plain = (s: string) => s.replace(/[⁦-⁩]/g, '');

export function eventLine(e: KhEvent): EventLine {
  const d = (e.data ?? {}) as Record<string, unknown>;
  switch (e.kind) {
    case 'escalation': {
      const to = RECIPIENT_AR[d.to as Recipient] ?? str(d.to);
      return {
        title: `تنبيه: ${REASON_AR[d.reason as EscReason] ?? str(d.reason)}`,
        to,
        why: plain(str(d.why)),
        tone: d.urgent ? 'urgent' : d.to === 'clinic' || d.to === 'family' ? 'warn' : 'info',
      };
    }
    case 'redflag':
      return {
        title: 'علامة خطر من المريض',
        to: 'العيادة والعائلة',
        why: plain(str(d.why)) + (d.text ? ` («${str(d.text)}»)` : ''),
        tone: 'urgent',
      };
    case 'quickcheck': {
      const skin = d.skin === 'wound' ? 'جرح أو فقاعة' : d.skin === 'red' ? 'احمرار' : 'الجلد عادي';
      const pain = d.pain === 'new' ? 'ألم أو خدر جديد' : 'بدون ألم جديد';
      return {
        title: 'فحص سريع',
        to: '—',
        why: `${skin}، ${pain}`,
        tone: d.skin === 'wound' ? 'urgent' : d.skin === 'red' || d.pain === 'new' ? 'warn' : 'info',
      };
    }
    case 'mode':
      return {
        title: `وضع ${MODE_AR[d.mode as Mode] ?? str(d.mode)}`,
        to: '—',
        why: d.mode === 'normal' ? 'رجوع للوضع العادي' : 'إيقاف مؤقت للتذكيرات والتصعيد',
        tone: 'info',
      };
    case 'question':
      return { title: 'سؤال طبي للممرضة', to: 'العيادة', why: `«${str(d.text)}»`, tone: 'warn' };
    case 'message':
      return {
        title: d.topic === 'device' ? 'بلاغ عن السجادة' : 'رسالة من المريض',
        to: d.topic === 'device' ? 'الدعم' : 'العيادة',
        why: str(d.text),
        tone: 'info',
      };
    case 'booking':
      return {
        title: 'طلب موعد (تجريبي)',
        to: 'العيادة',
        why: `${str(d.date)} · ${str(d.slot)}${d.note ? ` · ${str(d.note)}` : ''}`,
        tone: 'info',
      };
    case 'photo':
      return {
        title: d.role === 'base' ? 'صورة أساس' : 'صورة قدم',
        to: 'العيادة',
        why: 'للاطلاع، بدون تحليل',
        tone: 'info',
      };
    case 'reminder':
      return { title: 'ضبط التذكير اليومي', to: 'المريض', why: str(d.time), tone: 'info' };
    case 'family_ack':
      return { title: 'العائلة تواصلت مع المريض', to: '—', why: '', tone: 'info' };
    case 'clinic_ack':
      return { title: 'العيادة اطّلعت', to: '—', why: str(d.note), tone: 'info' };
    default:
      return { title: e.kind, to: '—', why: '', tone: 'info' };
  }
}
