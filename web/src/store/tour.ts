/**
 * «جرّب السيناريو»: a guided walk through the whole story on an isolated simulated device.
 * It saves the visitor's settings and chat, switches to a fresh simulation (device khatwa-tour,
 * demo mode = one scan per day), and puts everything back when it ends. Nothing reaches Firebase.
 */
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { SimulationSource } from '@/data/SimulationSource';
import type { DataSource } from '@/data/DataSource';
import { useChat } from './chat';
import { useDevice } from './device';
import { type SettingsState, useSettings } from './settings';

export const TOUR_DEVICE_ID = 'khatwa-tour';
/** Fast simulated clock so a stand takes a few seconds in the tour. */
export const TOUR_TICK_MS = 120;
/** What the visitor types to Rafiq in the tour (and in the video). */
export const TOUR_RAFIQ_TEXT = 'رجلي متورمة وفيها شي ينز';

type SavedSettings = Pick<
  SettingsState,
  | 'dataSource'
  | 'deviceId'
  | 'demoMode'
  | 'demoSince'
  | 'role'
  | 'onboarded'
  | 'consents'
  | 'session'
  | 'simSeed'
>;

export type TourAction = 'scan1' | 'scan2' | 'none';

export interface TourStep {
  id: string;
  route: string;
  role: 'patient' | 'family' | 'clinic';
  title: string;
  body: string;
  /** Run when the step opens (a simulated stand on the mat). */
  action: TourAction;
  /** Card at the top when the screen has its own controls at the bottom (Rafiq's input). */
  top?: boolean;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'scan1',
    route: '/scan',
    role: 'patient',
    action: 'scan1',
    title: 'فحص اليوم',
    body: 'المريض يقف على السجادة قبل الوضوء. نقيس حرارة 4 نقاط في كل قدم. هنا القدم اليمنى أسخن عند رأس المشط الأول.',
  },
  {
    id: 'day1',
    route: '/result',
    role: 'patient',
    action: 'none',
    title: 'اليوم الأول: أصفر',
    body: 'فرق أكبر من 2.2° في نفس النقطة. يوم واحد ما يكفي، فنطلب منه يقيس بكرة.',
  },
  {
    id: 'scan2',
    route: '/scan',
    role: 'patient',
    action: 'scan2',
    title: 'اليوم الثاني',
    body: 'نفس الوقفة في اليوم التالي. (في هذه الجولة كل فحص = يوم.)',
  },
  {
    id: 'day2',
    route: '/result',
    role: 'patient',
    action: 'none',
    title: 'اليوم الثاني: برتقالي',
    body: 'نفس النقطة يومين ورا بعض = قاعدة IWGDF. السبب مكتوب بالعربي، ومعه وش يسوي المريض.',
  },
  {
    id: 'family-alert',
    route: '/result#whatsapp',
    role: 'patient',
    action: 'none',
    title: 'تنبيه العائلة',
    body: 'زر واتساب يجهّز رسالة للعائلة فيها المستوى والنقطة. ما نرسل شي بدون ما يضغط المريض.',
  },
  {
    id: 'family',
    route: '/family',
    role: 'family',
    action: 'none',
    title: 'شاشة العائلة',
    body: 'العائلة تشوف حالة قريبها والتنبيهات اللي وصلتها، وتتصل أو ترسل واتساب بضغطة.',
  },
  {
    id: 'rafiq',
    route: '/assistant',
    role: 'patient',
    action: 'none',
    top: true,
    title: 'رفيق',
    body: 'كتبنا لك جملة مثل ما يكتب المريض. اضغط إرسال: علامة الخطر تقلب المستوى أحمر.',
  },
  {
    id: 'clinic',
    route: '/clinic',
    role: 'clinic',
    action: 'none',
    title: 'العيادة',
    body: 'المرضى مرتّبين بالأولوية. مريضنا فوق بالأحمر، والبقية «افتراضي».',
  },
  {
    id: 'report',
    route: '/clinic/patient/real/report',
    role: 'clinic',
    action: 'none',
    title: 'تقرير الزيارة',
    body: 'تقرير للطبيب من القراءات والأحداث، مع QR وطباعة PDF. كل شي في الجولة «محاكاة».',
  },
];

interface TourState {
  active: boolean;
  step: number;
  saved: { settings: SavedSettings; chat: ReturnType<typeof useChat.getState>['days'] } | null;
  /** Text waiting in Rafiq's input box (the Rafiq step). Consumed by the assistant screen. */
  draft: string;
  set: (p: Partial<Omit<TourState, 'set'>>) => void;
}

export const useTour = create<TourState>()(
  persist((set) => ({ active: false, step: 0, saved: null, draft: '', set: (p) => set(p) }), {
    name: 'kh.tour',
    storage: createJSONStorage(() => {
      try {
        return localStorage;
      } catch {
        const m = new Map<string, string>();
        return {
          getItem: (k) => m.get(k) ?? null,
          setItem: (k, v) => void m.set(k, v),
          removeItem: (k) => void m.delete(k),
        };
      }
    }),
    partialize: ({ active, step, saved }) => ({ active, step, saved }),
  }),
);

/** Starts the tour: saves the visitor's state and switches to a fresh simulated device. */
export function startTour() {
  const s = useSettings.getState();
  const saved: SavedSettings = {
    dataSource: s.dataSource,
    deviceId: s.deviceId,
    demoMode: s.demoMode,
    demoSince: s.demoSince,
    role: s.role,
    onboarded: s.onboarded,
    consents: s.consents,
    session: s.session,
    simSeed: s.simSeed,
  };
  try {
    localStorage.removeItem(`kh.sim.${TOUR_DEVICE_ID}`);
  } catch {
    /* private mode: the simulation starts in memory anyway */
  }
  useTour.getState().set({
    active: true,
    step: 0,
    saved: { settings: saved, chat: useChat.getState().days },
    draft: '',
  });
  useChat.setState({ days: {} });
  useSettings.getState().set({
    dataSource: 'simulation',
    deviceId: TOUR_DEVICE_ID,
    demoMode: true,
    demoSince: 0,
    role: 'patient',
    onboarded: true,
    session: s.session ?? { phone: '0500000000' },
    consents: { core: true, photos: true, family: true, acceptedAt: s.consents.acceptedAt ?? Date.now() },
    simSeed: null,
  });
}

/** Ends the tour and puts the visitor's settings and chat back. Returns where to go next. */
export function endTour(): string {
  const { saved } = useTour.getState();
  if (saved) {
    useSettings.getState().set(saved.settings);
    useChat.setState({ days: saved.chat });
  }
  try {
    localStorage.removeItem(`kh.sim.${TOUR_DEVICE_ID}`);
  } catch {
    /* ignore */
  }
  useTour.getState().set({ active: false, step: 0, saved: null, draft: '' });
  return '/';
}

/** Resolves with the tour's simulation source once the binder has created it. */
export function tourSource(timeoutMs = 10_000): Promise<SimulationSource> {
  const isTour = (s: DataSource | null): s is SimulationSource =>
    s instanceof SimulationSource && s.deviceId === TOUR_DEVICE_ID;
  const now = useDevice.getState().source;
  if (isTour(now)) return Promise.resolve(now);
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => (off(), reject(new Error('tour source not ready'))), timeoutMs);
    const off = useDevice.subscribe((st) => {
      if (isTour(st.source)) {
        clearTimeout(t);
        off();
        resolve(st.source);
      }
    });
  });
}
