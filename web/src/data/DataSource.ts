import type { DeviceStatus, KhEvent, Live, NewEvent, Scan } from './types';

export type SourceKind = 'firebase' | 'simulation' | 'serial';
export type Unsubscribe = () => void;

export interface ConnectionState {
  /** Reachable right now (Firebase: `.info/connected`; serial: port open; simulation: always). */
  connected: boolean;
  /** Signed in / ready to read and write. */
  ready: boolean;
  /** Human-readable Arabic problem, if any. */
  error?: string;
  /** Retry attempt in progress (Firebase sign-in backoff). */
  retrying?: boolean;
}

export interface RejectedRecord {
  id: string;
  error: string;
}

/**
 * The single interface every screen depends on. Screens never import Firebase directly.
 * All three sources deliver the same shapes (docs/DATA_SCHEMA.md), so switching is invisible to the UI.
 */
export interface DataSource {
  readonly kind: SourceKind;
  readonly deviceId: string;
  start(): Promise<void>;
  stop(): void;
  subscribeConnection(cb: (c: ConnectionState) => void): Unsubscribe;
  subscribeStatus(cb: (status: DeviceStatus | null, online: boolean) => void): Unsubscribe;
  subscribeLive(cb: (live: Live | null) => void): Unsubscribe;
  subscribeScans(cb: (scans: Scan[], rejected: RejectedRecord[]) => void): Unsubscribe;
  subscribeEvents(cb: (events: KhEvent[]) => void): Unsubscribe;
  writeEvent(e: NewEvent): Promise<void>;
  /** Current time on the server clock (ms). Used for "online" and day keys. */
  serverNow(): number;
}

/** Small typed event emitter shared by the sources. Replays the last value to new subscribers. */
export class Channel<T> {
  private subs = new Set<(v: T) => void>();
  private last: { v: T } | null = null;
  emit(v: T) {
    this.last = { v };
    this.subs.forEach((cb) => cb(v));
  }
  subscribe(cb: (v: T) => void): Unsubscribe {
    this.subs.add(cb);
    if (this.last) cb(this.last.v);
    return () => this.subs.delete(cb);
  }
  get value(): T | undefined {
    return this.last?.v;
  }
  clear() {
    this.subs.clear();
    this.last = null;
  }
}
