import { useEffect } from 'react';
import { createSource, type DataSource } from '@/data';
import { initialDevice, useDevice } from './device';
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

    void createSource(kind, deviceId, { tickMs: tick }).then((s) => {
      if (cancelled) return;
      src = s;
      useDevice.setState({ source: s });
      offs = [
        s.subscribeConnection((connection) => useDevice.setState({ connection })),
        s.subscribeStatus((status, online) => useDevice.setState({ status, online })),
        s.subscribeLive((live) => useDevice.setState({ live })),
        s.subscribeScans((scans, rejected) => useDevice.setState({ scans, rejected, loaded: true })),
        s.subscribeEvents((events) => useDevice.setState({ events, eventsLoaded: true })),
        s.subscribePhotos((photos) => useDevice.setState({ photos })),
      ];
      void s.start();
    });

    return () => {
      cancelled = true;
      offs.forEach((f) => f());
      src?.stop();
    };
  }, [kind, deviceId]);
}
