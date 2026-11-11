import { describe, expect, test } from 'vitest';
import { DEMO_PATIENT_NAME, shownPatientName } from './settings';

describe('shownPatientName', () => {
  const base = { patientName: '', dataSource: 'simulation' as const, demoMode: false };
  test('simulation, Wokwi and demo mode: «أبو سعد» when no name was typed', () => {
    expect(shownPatientName(base, 'x')).toBe(DEMO_PATIENT_NAME);
    expect(shownPatientName({ ...base, dataSource: 'wokwi' }, 'x')).toBe('أبو سعد');
    expect(shownPatientName({ ...base, dataSource: 'firebase', demoMode: true }, 'x')).toBe('أبو سعد');
  });
  test('the real mat keeps the neutral fallback; a typed name always wins', () => {
    expect(shownPatientName({ ...base, dataSource: 'firebase' }, 'مريض خطوة 01')).toBe('مريض خطوة 01');
    expect(shownPatientName({ ...base, patientName: ' أم سعد ' }, 'x')).toBe('أم سعد');
  });
});
