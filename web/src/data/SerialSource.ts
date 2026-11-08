/**
 * USB fallback: reads the ESP32 over Web Serial (115200 baud), one JSON line per reading:
 *   {"L":[a,b,c,d],"R":[a,b,c,d],"fsrL":n,"fsrR":n}
 * Same shape as live. Used when the internet fails on demo day. Chrome/Edge desktop and Android only.
 * Scans and events are kept locally (no internet assumed).
 */
import { Channel, type ConnectionState, type DataSource, type RejectedRecord } from './DataSource';
import { StabilityTracker } from './stability';
import {
  type NewPhoto,
  type Photo,
  type DeviceStatus,
  type KhEvent,
  type Live,
  type NewEvent,
  type Scan,
  SerialLineSchema,
} from './types';

export const serialSupported = () => typeof navigator !== 'undefined' && 'serial' in navigator;

/** Parses one line. Returns null for blank lines, debug prints and malformed JSON. */
export function parseSerialLine(line: string) {
  const t = line.trim();
  if (!t.startsWith('{')) return null;
  try {
    const r = SerialLineSchema.safeParse(JSON.parse(t));
    return r.success ? r.data : null;
  } catch {
    return null;
  }
}

export class SerialSource implements DataSource {
  readonly kind = 'serial' as const;
  private conn = new Channel<ConnectionState>();
  private status = new Channel<{ status: DeviceStatus | null; online: boolean }>();
  private live = new Channel<Live | null>();
  private scansCh = new Channel<{ scans: Scan[]; rejected: RejectedRecord[] }>();
  private eventsCh = new Channel<KhEvent[]>();
  private photosCh = new Channel<Photo[]>();
  private photos: Photo[] = [];
  private scans: Scan[] = [];
  private events: KhEvent[] = [];
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<string> | null = null;
  private tracker = new StabilityTracker();
  private lastLineAt = 0;
  private seq = 0;
  private timer: ReturnType<typeof setInterval> | null = null;
  /** Last rejected raw line, shown on the "My device" screen for debugging. */
  lastRejected: string | null = null;

  constructor(readonly deviceId: string) {}

  serverNow() {
    return Date.now();
  }

  async start() {
    this.conn.emit({
      connected: false,
      ready: false,
      error: serialSupported() ? undefined : 'المتصفح ما يدعم USB',
    });
    this.scansCh.emit({ scans: [], rejected: [] });
    this.eventsCh.emit([]);
    this.photosCh.emit([]);
    this.live.emit(null);
    this.status.emit({ status: null, online: false });
    this.timer = setInterval(() => this.emitStatus(), 2000);
  }

  /** Must be called from a user gesture (button click): the browser shows the port picker. */
  async connect() {
    if (!serialSupported()) return;
    try {
      this.port = await navigator.serial.requestPort();
      await this.port.open({ baudRate: 115200 });
      this.conn.emit({ connected: true, ready: true });
      void this.readLoop();
    } catch {
      this.conn.emit({ connected: false, ready: false, error: 'ما تم الاتصال بالجهاز عبر USB' });
    }
  }

  private async readLoop() {
    if (!this.port?.readable) return;
    const stream = this.port.readable.pipeThrough(
      new TextDecoderStream() as unknown as ReadableWritablePair<string, Uint8Array>,
    );
    this.reader = stream.getReader();
    let buf = '';
    try {
      for (;;) {
        const { value, done } = await this.reader.read();
        if (done) break;
        buf += value;
        let nl: number;
        while ((nl = buf.indexOf('\n')) >= 0) {
          this.onLine(buf.slice(0, nl));
          buf = buf.slice(nl + 1);
        }
      }
    } catch {
      /* unplugged */
    }
    this.conn.emit({ connected: false, ready: false, error: 'انفصل الجهاز' });
  }

  onLine(line: string) {
    const d = parseSerialLine(line);
    if (!d) {
      if (line.trim()) this.lastRejected = line.trim().slice(0, 120);
      return;
    }
    this.lastLineAt = Date.now();
    const { live, scan } = this.tracker.push({
      t: performance.now() / 1000,
      L: d.L,
      R: d.R,
      fsrL: d.fsrL,
      fsrR: d.fsrR,
    });
    this.live.emit({ ...live, ts: this.serverNow() });
    if (scan) {
      this.scans = [
        ...this.scans,
        { ...scan, id: `usb-${this.seq++}`, ts: this.serverNow(), source: 'serial', firmware: 'usb' },
      ];
      this.scansCh.emit({ scans: this.scans, rejected: [] });
    }
    this.emitStatus();
  }

  private emitStatus() {
    const online = Date.now() - this.lastLineAt < 10_000;
    this.status.emit({
      status: this.lastLineAt ? { online, lastSeen: this.lastLineAt, firmware: 'usb' } : null,
      online,
    });
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    void this.reader?.cancel().catch(() => {});
    void this.port?.close().catch(() => {});
    [this.conn, this.status, this.live, this.scansCh, this.eventsCh].forEach((c) => c.clear());
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
    return this.scansCh.subscribe((v) => cb(v.scans, v.rejected));
  }
  subscribeEvents(cb: (e: KhEvent[]) => void) {
    return this.eventsCh.subscribe(cb);
  }
  subscribePhotos(cb: (p: Photo[]) => void) {
    return this.photosCh.subscribe(cb);
  }
  async writePhoto(p: NewPhoto) {
    this.photos = [...this.photos, { ...p, ts: this.serverNow(), id: `usb-ph-${this.seq++}` }].slice(-12);
    this.photosCh.emit(this.photos);
  }
  async writeEvent(e: NewEvent) {
    this.events = [...this.events, { ...e, ts: this.serverNow(), id: `usb-ev-${this.seq++}` }];
    this.eventsCh.emit(this.events);
  }
}
