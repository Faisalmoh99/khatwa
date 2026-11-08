import { useEffect } from 'react';
import { createSource, type DataSource } from '@/data';
import { loadSnapshot, saveSnapshot } from '@/data/cache';
import { liveMessages } from '@/lib/quality';
import { initialDevice, newestArrival, rememberMsgs, useDevice } from './device';
import { useSettings } from './settings';

/**
 * Creates the active DataSource from settings and pipes it into the device store.
 * Changing the source or device id tears down the old one. No screen is aware of the switch.
 */
export function useSourceBinding() {
  const kind = useSettings((s) => s.dataSource);
  const deviceId = useSettings((s) => s.deviceId);

  useEffect(() => {
    let cancelled = false;
    let src: DataSource | null = null;
    let offs: (() => void)[] = [];
    const tick = Number(new URLSearchParams(location.search).get('simTick')) || undefined;
    useDevice.setState({ source: null, ...initialDevice });
    // Offline start: show the last snapshot saved on this phone until live data arrives.
    if (kind === 'firebase') {
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
      if (kind !== 'firebase') return;
      if (saveTimer) clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const st = useDevice.getState();
        if (st.eventsLoaded && !st.fromCache)
          saveSnapshot(deviceId, { scans: st.scans, events: st.events, status: st.status });
      }, 1000);
    };

    void createSource(kind, deviceId, { tickMs: tick }).then((s) => {
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
      void s.start();
    });

    return () => {
      cancelled = true;
      if (saveTimer) clearTimeout(saveTimer);
      offs.forEach((f) => f());
      src?.stop();
    };
  }, [kind, deviceId]);
}
