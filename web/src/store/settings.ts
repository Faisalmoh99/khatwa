/**
 * Per-device user settings, persisted in localStorage. Never stores secrets.
 * URL overrides (?source=sim&dev=khatwa-test) win over stored values, for demos and e2e tests.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { SourceKind } from '@/data/DataSource';
import { DEFAULT_DEVICE_ID } from '@/data/firebase-config';

export type Role = 'patient' | 'family' | 'clinic';

export interface Consents {
  /** Required: data collection and sharing with the clinic. */
  core: boolean;
  /** Separate: foot photos stored for the clinic. */
  photos: boolean;
  /** Separate: alerts shared with a family contact. */
  family: boolean;
  acceptedAt?: number;
}

export interface SettingsState {
  /** First-time visitors start on the simulation (demo build); the real mat is chosen in Settings. */
  dataSource: SourceKind;
  /**
   * «هذا جوال المريض». Off by default. Nothing is written to Firebase unless the source is the real mat
   * AND this is on, so a judge or a visitor opening the demo link can never write into the real device.
   */
  patientDevice: boolean;
  /** 30-day history loaded into an empty simulation once (first visit). Cleared after use or by ?source=. */
  simSeed: string | null;
  deviceId: string;
  /** Demo mode: every scan counts as one day (needed to show the 2-day rule in a short video). */
  demoMode: boolean;
  /** When demo mode was switched on (server ms). Scans after it without demoDay get one assigned. */
  demoSince: number | null;
  role: Role | null;
  onboarded: boolean;
  consents: Consents;
  /** Demo login (phone + OTP 1234). Not real authentication. */
  session: { phone: string } | null;
  /** How the patient is called in family messages (optional). */
  patientName: string;
  /** For the family role: the patient's phone, used by the call and WhatsApp buttons. */
  patientPhone: string;
  familyName: string;
  familyPhone: string;
  /** HH:MM, Riyadh time. */
  reminderTime: string;
  voice: boolean;
  set: (p: Partial<Omit<SettingsState, 'set'>>) => void;
}

const safeStorage = createJSONStorage(() => {
  try {
    return localStorage;
  } catch {
    const mem = new Map<string, string>();
    return {
      getItem: (k) => mem.get(k) ?? null,
      setItem: (k, v) => void mem.set(k, v),
      removeItem: (k) => void mem.delete(k),
    };
  }
});

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      dataSource: 'simulation',
      patientDevice: false,
      simSeed: 'developing',
      deviceId: DEFAULT_DEVICE_ID,
      demoMode: false,
      demoSince: null,
      role: null,
      onboarded: false,
      consents: { core: false, photos: false, family: false },
      session: null,
      patientName: '',
      patientPhone: '',
      familyName: '',
      familyPhone: '',
      reminderTime: '20:00',
      voice: true,
      set: (p) => set(p),
    }),
    {
      name: 'kh.settings',
      storage: safeStorage,
      version: 2,
      // v1 phones keep their source; the write switch starts off and nothing is preloaded.
      migrate: (old) => ({ ...(old as object), patientDevice: false, simSeed: null }) as SettingsState,
    },
  ),
);

/** Applies ?source= and ?dev= from the URL once at startup. */
export function applyUrlOverrides(search = typeof location !== 'undefined' ? location.search : '') {
  const q = new URLSearchParams(search);
  const src = q.get('source');
  const map: Record<string, SourceKind> = {
    sim: 'simulation',
    simulation: 'simulation',
    firebase: 'firebase',
    usb: 'serial',
    serial: 'serial',
    wokwi: 'wokwi',
  };
  const patch: Partial<SettingsState> = {};
  // An explicit source in the link means an explicit setup (tests, demo links): no preloaded history.
  if (src && map[src]) Object.assign(patch, { dataSource: map[src], simSeed: null });
  // ?writes=1 = «هذا جوال المريض» (Firebase e2e tests write to a test device).
  if (q.get('writes') === '1') patch.patientDevice = true;
  const dev = q.get('dev');
  if (dev && /^[a-z0-9-]{3,40}$/i.test(dev)) patch.deviceId = dev;
  if (q.get('demo') === '1') Object.assign(patch, { demoMode: true, demoSince: 0 });
  // ?as=patient|family|clinic skips onboarding for demo links and e2e tests.
  const as = q.get('as');
  if (as === 'patient' || as === 'family' || as === 'clinic') {
    Object.assign(patch, {
      role: as,
      onboarded: true,
      session: { phone: '0500000000' },
      consents: { core: true, photos: true, family: true, acceptedAt: Date.now() },
    });
  }
  if (Object.keys(patch).length) useSettings.getState().set(patch);
}
