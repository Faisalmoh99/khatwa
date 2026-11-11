/**
 * Real device source: Firebase Realtime Database + anonymous auth.
 * Fixes review finding R6: sign-in retries with exponential backoff instead of failing once.
 */
import { type FirebaseApp, getApp, getApps, initializeApp } from 'firebase/app';
import { type Auth, getAuth, onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import {
  type Database,
  getDatabase,
  limitToLast,
  onValue,
  orderByChild,
  push,
  query,
  ref,
  serverTimestamp,
} from 'firebase/database';
import {
  Channel,
  type ConnectionState,
  type DataSource,
  ReadOnlyError,
  type RejectedRecord,
  type Unsubscribe,
} from './DataSource';
import { firebaseConfig } from './firebase-config';
import {
  type DeviceStatus,
  EventSchema,
  type KhEvent,
  type Live,
  LiveSchema,
  type NewEvent,
  type NewPhoto,
  type Photo,
  PhotoSchema,
  isOnline,
  parseCollection,
  type Scan,
  ScanSchema,
  StatusSchema,
} from './types';

const MAX_BACKOFF_MS = 30_000;

export interface FirebaseSourceOptions {
  /** 'wokwi' = the virtual mat (same database, read-only for the app). */
  kind?: 'firebase' | 'wokwi';
  /** Checked on every write. Default: no writes (read-only viewer). */
  canWrite?: () => boolean;
}

export class FirebaseSource implements DataSource {
  readonly kind: 'firebase' | 'wokwi';
  private readonly canWrite: () => boolean;
  private app!: FirebaseApp;
  private db!: Database;
  private auth!: Auth;
  private offs: Unsubscribe[] = [];
  private serverOffset = 0;
  private stopped = false;
  /** Resolves once signed in. Writes wait for it (a write before sign-in is rejected by the rules). */
  private ready!: Promise<void>;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private lastStatus: DeviceStatus | null = null;

  private conn = new Channel<ConnectionState>();
  private status = new Channel<{ status: DeviceStatus | null; online: boolean }>();
  private live = new Channel<Live | null>();
  private scans = new Channel<{ scans: Scan[]; rejected: RejectedRecord[] }>();
  private events = new Channel<KhEvent[]>();
  private photos = new Channel<Photo[]>();

  constructor(
    readonly deviceId: string,
    opts: FirebaseSourceOptions = {},
  ) {
    this.kind = opts.kind ?? 'firebase';
    this.canWrite = opts.canWrite ?? (() => false);
  }

  get writable() {
    return this.canWrite();
  }

  private path(sub: string) {
    return `devices/${this.deviceId}/${sub}`;
  }

  serverNow() {
    return Date.now() + this.serverOffset;
  }

  async start() {
    this.stopped = false;
    this.app = getApps().length ? getApp() : initializeApp(firebaseConfig);
    this.db = getDatabase(this.app);
    this.auth = getAuth(this.app);
    this.conn.emit({ connected: false, ready: false });

    // Network state and server clock do not need auth.
    this.offs.push(
      onValue(ref(this.db, '.info/connected'), (s) => {
        const connected = s.val() === true;
        const prev = this.conn.value;
        this.conn.emit({ ...prev, connected, ready: prev?.ready ?? false });
      }),
      onValue(ref(this.db, '.info/serverTimeOffset'), (s) => {
        this.serverOffset = Number(s.val()) || 0;
      }),
    );
    this.ready = this.signInWithRetry(0);
    await this.ready;
  }

  private signInWithRetry(attempt: number): Promise<void> {
    return new Promise((resolve) => {
      const tryOnce = async (n: number) => {
        if (this.stopped) return resolve();
        try {
          if (!this.auth.currentUser) await signInAnonymously(this.auth);
          await new Promise<void>((ok) => {
            const off = onAuthStateChanged(this.auth, (u) => {
              if (u) {
                off();
                ok();
              }
            });
          });
          this.conn.emit({ connected: this.conn.value?.connected ?? false, ready: true });
          this.subscribeData();
          resolve();
        } catch (e) {
          const wait = Math.min(MAX_BACKOFF_MS, 1000 * 2 ** n);
          this.conn.emit({
            connected: this.conn.value?.connected ?? false,
            ready: false,
            retrying: true,
            error: friendlyError(e),
          });
          this.retryTimer = setTimeout(() => void tryOnce(n + 1), wait);
        }
      };
      void tryOnce(attempt);
    });
  }

  private subscribeData() {
    const emitStatus = () => {
      const s = this.lastStatus;
      const online = isOnline(s, this.serverNow());
      this.status.emit({ status: s, online });
    };
    this.offs.push(
      onValue(ref(this.db, this.path('status')), (snap) => {
        const r = StatusSchema.safeParse(snap.val());
        this.lastStatus = r.success ? r.data : null;
        emitStatus();
      }),
      onValue(ref(this.db, this.path('live')), (snap) => {
        const r = LiveSchema.safeParse(snap.val());
        this.live.emit(r.success ? r.data : null);
      }),
      onValue(query(ref(this.db, this.path('scans')), orderByChild('ts'), limitToLast(300)), (snap) => {
        const { items, rejected } = parseCollection(ScanSchema, snap.val());
        this.scans.emit({ scans: items as Scan[], rejected });
      }),
      onValue(
        query(ref(this.db, this.path('photos')), orderByChild('ts'), limitToLast(12)),
        (snap) => {
          const { items } = parseCollection(PhotoSchema, snap.val());
          this.photos.emit(items as Photo[]);
        },
        () => this.photos.emit([]),
      ),
      onValue(query(ref(this.db, this.path('events')), orderByChild('ts'), limitToLast(300)), (snap) => {
        const { items } = parseCollection(EventSchema, snap.val());
        this.events.emit(items as KhEvent[]);
      }),
    );
    // "Online" goes stale without new data, so re-check every 5 s.
    const t = setInterval(emitStatus, 5000);
    this.offs.push(() => clearInterval(t));
  }

  stop() {
    this.stopped = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.offs.forEach((f) => f());
    this.offs = [];
    [this.conn, this.status, this.live, this.scans, this.events, this.photos].forEach((c) => c.clear());
  }

  subscribeConnection(cb: (c: ConnectionState) => void) {
    return this.conn.subscribe(cb);
  }
  subscribeStatus(cb: (s: DeviceStatus | null, online: boolean) => void) {
    return this.status.subscribe((v) => cb(v.status, v.online));
  }
  subscribeLive(cb: (l: Live | null) => void) {
    return this.live.subscribe(cb);
  }
  subscribeScans(cb: (s: Scan[], r: RejectedRecord[]) => void) {
    return this.scans.subscribe((v) => cb(v.scans, v.rejected));
  }
  subscribeEvents(cb: (e: KhEvent[]) => void) {
    return this.events.subscribe(cb);
  }

  subscribePhotos(cb: (p: Photo[]) => void) {
    return this.photos.subscribe(cb);
  }
  async writePhoto(p: NewPhoto) {
    if (!this.canWrite()) throw new ReadOnlyError();
    await this.ready;
    await push(ref(this.db, this.path('photos')), { ...stripUndefined(p), ts: serverTimestamp() });
  }

  async writeEvent(e: NewEvent) {
    if (!this.canWrite()) throw new ReadOnlyError();
    await this.ready;
    await push(ref(this.db, this.path('events')), { ...stripUndefined(e), ts: serverTimestamp() });
  }
}

/** RTDB rejects `undefined` values. */
function stripUndefined<T extends object>(o: T): T {
  return JSON.parse(JSON.stringify(o)) as T;
}

function friendlyError(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code.includes('network')) return 'لا يوجد اتصال بالإنترنت. نحاول مرة ثانية…';
  if (code.includes('unauthorized-domain')) return 'هذا الرابط غير مسموح في إعدادات Firebase.';
  if (code.includes('operation-not-allowed')) return 'الدخول المجهول غير مفعّل في Firebase.';
  return 'تعذّر الاتصال بالخادم. نحاول مرة ثانية…';
}
