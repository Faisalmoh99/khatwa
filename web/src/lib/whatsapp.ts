/** Ready-made WhatsApp message to the family (wa.me). No API, no sending on our side. */
import { toLatinDigits } from './format';
import type { DayView } from './level';
import { LEVEL_WORD } from './words';

/** Saudi mobile (Arabic or Latin digits): 05XXXXXXXX / 5XXXXXXXX / +9665XXXXXXXX / 009665XXXXXXXX → 9665XXXXXXXX. Else null. */
export function normalizeSaudiPhone(raw: string): string | null {
  const d = toLatinDigits(raw)
    .replace(/[^\d+]/g, '')
    .replace(/^\+/, '')
    .replace(/^00/, '');
  if (/^9665\d{8}$/.test(d)) return d;
  if (/^05\d{8}$/.test(d)) return '966' + d.slice(1);
  if (/^5\d{8}$/.test(d)) return '966' + d;
  return null;
}

/** Strips Unicode bidi isolates (WhatsApp on older phones shows them as boxes). */
const plain = (s: string) => s.replace(/[⁦-⁩]/g, '');

export function familyMessage(view: Pick<DayView, 'level' | 'reasons'>, patientName = ''): string {
  const who = patientName.trim() || 'المريض';
  const why = plain(view.reasons.map((r) => r.ar).join('، '));
  const lines = [`تنبيه من خطوة عن ${who}:`, `مستوى اليوم: ${LEVEL_WORD[view.level]}.`];
  if (why) lines.push(`السبب: ${why}.`);
  if (view.level === 'red') lines.push('المطلوب: يراجع الطبيب خلال 24 ساعة. تواصل معه الحين.');
  else if (view.level === 'orange') lines.push('المطلوب: تواصل معه اليوم وتطمّن عليه.');
  else lines.push('للاطلاع فقط.');
  lines.push('(خطوة أداة مراقبة، مو تشخيص)');
  return lines.join('\n');
}

export function whatsappLink(phone: string, text: string): string {
  const p = normalizeSaudiPhone(phone);
  const q = `text=${encodeURIComponent(text)}`;
  return p ? `https://wa.me/${p}?${q}` : `https://wa.me/?${q}`;
}

export function telLink(phone: string): string | null {
  const p = normalizeSaudiPhone(phone);
  return p ? `tel:+${p}` : null;
}

/** "أرسل لـسعد على واتساب", or "أرسل للعائلة على واتساب" when no name is saved. */
export function sendLabel(name: string): string {
  const n = name.trim();
  if (!n) return 'أرسل للعائلة على واتساب';
  // "ل" + "ال..." is written "لل..." (never "لـال").
  return n.startsWith('ال') ? `أرسل لل${n.slice(2)} على واتساب` : `أرسل لـ${n} على واتساب`;
}
