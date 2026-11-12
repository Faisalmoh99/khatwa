/** Device data exactly as delivered by the active DataSource. Screens read; only the binder writes. */
import { create } from 'zustand';
import type { ConnectionState, DataSource, RejectedRecord } from '@/data/DataSource';
import type { QualityMsg } from '@/lib/quality';
import type { DeviceStatus, KhEvent, Live, NewEvent, NewPhoto, Photo, Scan } from '@/data/types';

export interface DeviceState {
  source: DataSource | null;
  connection: ConnectionState;
  status: DeviceStatus | null;
  online: boolean;
  live: Live | null;
  scans: Scan[];
  rejected: RejectedRecord[];
  events: KhEvent[];
  photos: Photo[];
  /** Live quality messages seen in the last 3 s, so a brief warning stays readable. */
  liveMsgs: Record<string, { m: QualityMsg; until: number }>;
  /**
   * The newest scan that ARRIVED as an addition (not part of the first snapshot), with the phone-clock
   * time it arrived. The scan screen uses it; server time is never compared with the phone clock.
   */
  arrival: { id: string; at: number } | null;
  /** Showing the snapshot saved on the phone (no live data yet). */
  fromCache: boolean;
  /** True once the first events snapshot arrived (escalation writer waits for it). */
  eventsLoaded: boolean;
  /** True once the first scans snapshot arrived (avoids flashing "no data"). */
  loaded: boolean;
}

export const initialDevice: Omit<DeviceState, 'source'> = {
  connection: { connected: false, ready: false },
  status: null,
  online: false,
  live: null,
  scans: [],
  rejected: [],
  events: [],
  photos: [],
  liveMsgs: {},
  arrival: null,
  fromCache: false,
  eventsLoaded: false,
  loaded: false,
};

export const useDevice = create<DeviceState>()(() => ({ source: null, ...initialDevice }));

/** Writes an event through whichever source is active. */
export async function writeEvent(e: NewEvent) {
  await (await activeSource()).writeEvent(e);
}

/** The active source, waiting briefly if it is still being created (first seconds after load). */
export function activeSource(timeoutMs = 10_000): Promise<DataSource> {
  const now = useDevice.getState().source;
  if (now) return Promise.resolve(now);
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => (off(), reject(new Error('no data source'))), timeoutMs);
    const off = useDevice.subscribe((s) => {
      if (s.source) {
        clearTimeout(t);
        off();
        resolve(s.source);
      }
    });
  });
}

export const serverNow = () => useDevice.getState().source?.serverNow() ?? Date.now();

export async function writePhoto(p: NewPhoto) {
  await (await activeSource()).writePhoto(p);
}

/** Merges the current live messages into the 3-second memory (called on every live frame). */
export function rememberMsgs(
  prev: DeviceState['liveMsgs'],
  current: QualityMsg[],
  now = Date.now(),
): DeviceState['liveMsgs'] {
  const next: DeviceState['liveMsgs'] = {};
  for (const [k, v] of Object.entries(prev)) if (v.until > now) next[k] = v;
  for (const m of current) next[m.code] = { m, until: now + 3000 };
  return next;
}

const MEASURING = new Set(['placing', 'settling']);
export const isMeasuring = (live: Live | null | undefined) => !!live && MEASURING.has(live.phase);

/** The newest scan in `scans` whose id was not in the previous emission (null if none). */
export function newestArrival(prevIds: Set<string> | null, scans: Scan[]): string | null {
  if (!prevIds) return null; // first emission = existing history, not an arrival
  for (let i = scans.length - 1; i >= 0; i--) if (!prevIds.has(scans[i]!.id)) return scans[i]!.id;
  return null;
}
