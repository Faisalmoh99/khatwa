import { describe, expect, it } from 'vitest';
import { createSource, ReadOnlyError, WOKWI_DEVICE_ID, writeErrorAr } from '@/data';
import { FirebaseSource } from './FirebaseSource';
import { matStatusAr, ownPatientTag } from '@/lib/words';

const ev = { kind: 'quickcheck' as const, data: {} };
const photo = { role: 'today' as const, jpeg: 'data:image/jpeg;base64,AA' };

describe('write gate (Firebase writes need the real mat AND «هذا جوال المريض»)', () => {
  it('a Firebase source refuses writes by default, before touching the network', async () => {
    const s = new FirebaseSource('khatwa-01'); // never started: a real write would hang on sign-in
    expect(s.writable).toBe(false);
    await expect(s.writeEvent(ev)).rejects.toBeInstanceOf(ReadOnlyError);
    await expect(s.writePhoto(photo)).rejects.toBeInstanceOf(ReadOnlyError);
  });

  it('the permission is read at write time, so the switch applies at once', async () => {
    let on = false;
    const s = new FirebaseSource('khatwa-e2e', { canWrite: () => on });
    expect(s.writable).toBe(false);
    on = true;
    expect(s.writable).toBe(true);
  });

  it('the Wokwi source reads khatwa-demo and is always read-only, whatever the switch says', async () => {
    const s = await createSource('wokwi', 'khatwa-01', {}, () => true);
    expect(s.kind).toBe('wokwi');
    expect(s.deviceId).toBe(WOKWI_DEVICE_ID);
    expect(s.writable).toBe(false);
    await expect(s.writeEvent(ev)).rejects.toBeInstanceOf(ReadOnlyError);
  });

  it('simulation and USB stay local and writable', async () => {
    expect((await createSource('simulation', 'khatwa-01', { storage: null })).writable).toBe(true);
    expect((await createSource('serial', 'khatwa-01')).writable).toBe(true);
  });

  it('read-only errors explain the switch; other errors keep the network hint', () => {
    expect(writeErrorAr(new ReadOnlyError())).toContain('هذا جوال المريض');
    expect(writeErrorAr(new Error('x'), 'تأكد من الإنترنت')).toBe('تأكد من الإنترنت');
  });
});

describe('honest labels', () => {
  it('simulated data is never tagged as the real device', () => {
    expect(ownPatientTag('simulation')).toBe('محاكاة');
    expect(ownPatientTag('wokwi')).toContain('Wokwi');
    expect(ownPatientTag('firebase')).toBe('الجهاز الحقيقي');
    expect(matStatusAr('simulation', true)).not.toContain('السجادة');
  });
});
