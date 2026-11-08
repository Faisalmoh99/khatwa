/** Device data exactly as delivered by the active DataSource. Screens read; only the binder writes. */
import { create } from 'zustand';
import type { ConnectionState, DataSource, RejectedRecord } from '@/data/DataSource';
import type { DeviceStatus, KhEvent, Live, NewEvent, Scan } from '@/data/types';

export interface DeviceState {
  source: DataSource | null;
  connection: ConnectionState;
  status: DeviceStatus | null;
  online: boolean;
  live: Live | null;
  scans: Scan[];
  rejected: RejectedRecord[];
  events: KhEvent[];
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
  loaded: false,
};

export const useDevice = create<DeviceState>()(() => ({ source: null, ...initialDevice }));

/** Writes an event through whichever source is active. */
export async function writeEvent(e: NewEvent) {
  const src = useDevice.getState().source;
  if (!src) throw new Error('no data source');
  await src.writeEvent(e);
}

export const serverNow = () => useDevice.getState().source?.serverNow() ?? Date.now();
