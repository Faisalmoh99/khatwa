/**
 * Last known device data, kept on the phone so the app opens offline with the latest state.
 * Firebase RTDB has no offline persistence on the web, so we keep a small snapshot (no photos).
 * Never used to write anything: the escalation writer waits for live data.
 */
import type { DeviceStatus, KhEvent, Scan } from './types';

export interface Snapshot {
  scans: Scan[];
  events: KhEvent[];
  status: DeviceStatus | null;
  savedAt: number;
}

const key = (dev: string) => `kh.cache.${dev}`;

export function loadSnapshot(dev: string): Snapshot | null {
  try {
    const raw = localStorage.getItem(key(dev));
    if (!raw) return null;
    const s = JSON.parse(raw) as Snapshot;
    return Array.isArray(s.scans) && Array.isArray(s.events) ? s : null;
  } catch {
    return null;
  }
}

export function saveSnapshot(dev: string, s: Omit<Snapshot, 'savedAt'>) {
  try {
    localStorage.setItem(
      key(dev),
      JSON.stringify({ ...s, scans: s.scans.slice(-120), events: s.events.slice(-200), savedAt: Date.now() }),
    );
  } catch {
    /* storage full or blocked: offline view just shows less */
  }
}
