import { describe, expect, test } from 'vitest';
import { ago, consecutiveDays, dayWord, temp, toLatinDigits } from './format';

describe('Arabic number words (R8)', () => {
  test('dayWord', () => {
    expect(dayWord(1)).toBe('يوم واحد');
    expect(dayWord(2)).toBe('يومين');
    expect(dayWord(3)).toBe('3 أيام');
    expect(dayWord(10)).toBe('10 أيام');
    expect(dayWord(11)).toBe('11 يومًا');
  });
  test('consecutiveDays', () => {
    expect(consecutiveDays(2)).toBe('ليومين متتاليين');
    expect(consecutiveDays(3)).toBe('لمدة 3 أيام متتالية');
    expect(consecutiveDays(12)).toBe('لمدة 12 يومًا متتاليًا');
  });
  test('ago', () => {
    expect(ago(10_000)).toBe('الآن');
    expect(ago(120_000)).toBe('قبل دقيقتين');
    expect(ago(5 * 60_000)).toBe('قبل 5 دقائق');
    expect(ago(2 * 3_600_000)).toBe('قبل ساعتين');
    expect(ago(2 * 86_400_000)).toBe('قبل يومين');
  });
  test('temp keeps the sign on the left in the string (rendered inside .num LTR)', () => {
    expect(temp(-1.24, { signed: true })).toBe('-1.2°');
    expect(temp(2.6, { signed: true })).toBe('+2.6°');
    expect(temp(30.84)).toBe('30.8°');
  });
});

test('ltr isolates numbers for Arabic text', async () => {
  const { ltr } = await import('./format');
  expect(ltr('2.6°')).toBe('⁦2.6°⁩');
});

test('toLatinDigits converts Arabic-Indic and Persian digits', () => {
  expect(toLatinDigits('٠٥٥١٢٣٤٥٦٧')).toBe('0551234567');
  expect(toLatinDigits('۰۵۵۱۲۳۴۵۶۷')).toBe('0551234567');
  expect(toLatinDigits('١٢٣٤')).toBe('1234');
  expect(toLatinDigits('05 ٥١ abc')).toBe('05 51 abc');
});
