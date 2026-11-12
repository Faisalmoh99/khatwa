import { useEffect } from 'react';
import { createSource, type DataSource, SimulationSource, WOKWI_DEVICE_ID } from '@/data';
import { loadSnapshot, saveSnapshot } from '@/data/cache';
import { liveMessages } from '@/lib/quality';
import { initialDevice, newestArrival, rememberMsgs, useDevice } from './device';
import { useSettings } from './settings';
import { TOUR_TICK_MS, useTour } from './tour';

/** Firebase writes need the real mat AND «هذا جوال المريض». Read at write time, so toggling applies at once. */
export const firebaseWritesAllowed = () => {
  const s = useSettings.getState();
  return s.dataSource === 'firebase' && s.patientDevice;
};

/**
 * Creates the active DataSource from settings and pipes it into the device store.
 * Changing the source or device id tears down the old one. No screen is aware of the switch.
 */
export function useSourceBinding() {
  const kind = useSettings((s) => s.dataSource);
  const chosenId = useSettings((s) => s.deviceId);
  const deviceId = kind === 'wokwi' ? WOKWI_DEVICE_ID : chosenId;

  useEffect(() => {
    let cancelled = false;
    let src: DataSource | null = null;
    let offs: (() => void)[] = [];
    const urlTick = Number(new URLSearchParams(location.search).get('simTick')) || undefined;
    const tick = useTour.getState().active ? Math.min(urlTick ?? TOUR_TICK_MS, TOUR_TICK_MS) : urlTick;
    const remote = kind === 'firebase' || kind === 'wokwi';
    useDevice.setState({ source: null, ...initialDevice });
    // Offline start: show the last snapshot saved on this phone until live data arrives.
    if (remote) {
      const snap = loadSnapshot(deviceId);
      if (snap)
        useDevice.setState({
          scans: snap.scans,
          events: snap.events,
          status: snap.status,
          loaded: true,
          fromCache: true,
        });
    }
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    const persist = () => {
      if (!remote) return;
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const st = useDevice.getState();
        if (st.eventsLoaded && !st.fromCache)
          saveSnapshot(deviceId, { scans: st.scans, events: st.events, status: st.status });
      }, 1000);
    };

    void createSource(kind, deviceId, { tickMs: tick }, firebaseWritesAllowed).then((s) => {
      if (cancelled) return;
      src = s;
      useDevice.setState({ source: s });
      let prevIds: Set<string> | null = null;
      offs = [
        s.subscribeConnection((connection) => useDevice.setState({ connection })),
        s.subscribeStatus((status, online) => useDevice.setState({ status, online })),
        s.subscribeLive((live) =>
          useDevice.setState((st) => ({
            live,
            liveMsgs: rememberMsgs(st.liveMsgs, liveMessages(live)),
          })),
        ),
        s.subscribeScans((scans, rejected) => {
          const id = newestArrival(prevIds, scans);
          prevIds = new Set(scans.map((x) => x.id));
          useDevice.setState({
            scans,
            rejected,
            loaded: true,
            fromCache: false,
            ...(id ? { arrival: { id, at: Date.now() } } : {}),
          });
          persist();
        }),
        s.subscribeEvents((events) => (useDevice.setState({ events, eventsLoaded: true }), persist())),
        s.subscribePhotos((photos) => useDevice.setState({ photos })),
      ];
      void s.start().then(() => {
        // First visit: an empty simulation gets the 30-day "developing" history once (labelled simulation).
        const seed = useSettings.getState().simSeed;
        if (cancelled || !seed || !(s instanceof SimulationSource)) return;
        if (s.empty) s.loadDays(seed);
        useSettings.getState().set({ simSeed: null });
      });
    });

    return () => {
      cancelled = true;
      if (saveTimer) clearTimeout(saveTimer);
      offs.forEach((f) => f());
      src?.stop();
    };
  }, [kind, deviceId]);
}
