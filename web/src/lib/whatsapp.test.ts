import { expect, test } from 'vitest';
import { familyMessage, normalizeSaudiPhone, sendLabel, telLink, whatsappLink } from './whatsapp';

test('normalizes Saudi mobile numbers', () => {
  expect(normalizeSaudiPhone('0551234567')).toBe('966551234567');
  expect(normalizeSaudiPhone('+966 55 123 4567')).toBe('966551234567');
  expect(normalizeSaudiPhone('00966551234567')).toBe('966551234567');
  expect(normalizeSaudiPhone('551234567')).toBe('966551234567');
  expect(normalizeSaudiPhone('12345')).toBeNull();
});

test('wa.me link carries the encoded message, with or without a number', () => {
  expect(whatsappLink('0551234567', 'مرحبا')).toBe(
    `https://wa.me/966551234567?text=${encodeURIComponent('مرحبا')}`,
  );
  expect(whatsappLink('', 'x')).toBe('https://wa.me/?text=x');
});

test('tel link', () => {
  expect(telLink('0551234567')).toBe('tel:+966551234567');
  expect(telLink('')).toBeNull();
});

test('orange message: level, reason without bidi marks, action, and the disclaimer', () => {
  const m = familyMessage(
    {
      level: 'orange',
      reasons: [
        { code: 'thermal', ar: 'فرق ⁦2.6°⁩ عند رأس المشط الأول (القدم اليمنى أسخن) ليومين متتاليين' },
      ],
    },
    'أبو سعد',
  );
  expect(m).toContain('أبو سعد');
  expect(m).toContain('برتقالي');
  expect(m).toContain('2.6°');
  expect(m).not.toMatch(/[⁦-⁩]/);
  expect(m).toContain('تواصل معه اليوم');
  expect(m).toContain('مو تشخيص');
});

test('red message asks for a doctor visit within 24 hours', () => {
  expect(familyMessage({ level: 'red', reasons: [{ code: 'wound', ar: 'أبلغ عن جرح' }] })).toContain(
    'خلال 24 ساعة',
  );
});

test('Arabic-Indic digits are accepted as a Saudi number', () => {
  expect(normalizeSaudiPhone('٠٥٥١٢٣٤٥٦٧')).toBe('966551234567');
  expect(normalizeSaudiPhone('+٩٦٦٥٥١٢٣٤٥٦٧')).toBe('966551234567');
  expect(normalizeSaudiPhone('٠٥٥١٢')).toBeNull();
});

test('send button label: name, or "للعائلة" (never "لـالعائلة")', () => {
  expect(sendLabel('سعد')).toBe('أرسل لـسعد على واتساب');
  expect(sendLabel('  ')).toBe('أرسل للعائلة على واتساب');
});

test('send label never writes "لـال"', () => {
  expect(sendLabel('الوالد')).toBe('أرسل للوالد على واتساب');
});
