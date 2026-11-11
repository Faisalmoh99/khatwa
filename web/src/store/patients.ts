import { useMemo } from 'react';
import { useNow } from '@/hooks/useNow';
import { buildPatient, orderPatients, type PatientModel, virtualPatients } from '@/lib/patients';
import { serverNow, useDevice } from './device';
import { shownPatientName, useSettings } from './settings';

export const REAL_ID = 'real';

/** The real device patient as a PatientModel. */
export function useRealPatient(): PatientModel {
  const scans = useDevice((s) => s.scans);
  const events = useDevice((s) => s.events);
  const photos = useDevice((s) => s.photos);
  const name = useSettings((s) => shownPatientName(s, 'مريض خطوة 01'));
  const reminder = useSettings((s) => s.reminderTime);
  const demo = useSettings((s) => s.demoMode);
  const since = useSettings((s) => s.demoSince);
  const tick = useNow(60_000);
  return useMemo(() => {
    void tick;
    return buildPatient(
      { id: REAL_ID, name, age: null, virtual: false, scans, events, photos },
      serverNow(),
      reminder,
      { on: demo, since },
    );
  }, [scans, events, photos, name, reminder, demo, since, tick]);
}

/** Clinic list: the real patient first, then the synthetic roster by priority. */
export function usePatients(): PatientModel[] {
  const real = useRealPatient();
  const tick = useNow(60_000);
  const virtual = useMemo(() => {
    void tick;
    return virtualPatients(serverNow());
  }, [tick]);
  return useMemo(() => orderPatients(real, virtual), [real, virtual]);
}

export function usePatient(id: string | undefined): PatientModel | undefined {
  const list = usePatients();
  return list.find((p) => p.id === (id ?? REAL_ID));
}
