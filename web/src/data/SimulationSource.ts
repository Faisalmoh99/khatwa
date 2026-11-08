/**
 * In-browser simulation source. No Firebase. Same shapes as the real device.
 * Live scan logic is a line-by-line port of app/sim/index.html (placing → settling → done/error).
 * Scans and events persist in localStorage per device id so a reload keeps the history.
 */
import { Channel, type ConnectionState, type DataSource, type RejectedRecord } from './DataSource';
import {
  DAYS_SCENARIOS,
  FSR_MIN,
  generateDays,
  LIVE_SCENARIOS,
  type LiveScenario,
  MAX_SEC,
  MIN_SEC,
  SKIN,
  STABLE_DELTA,
  STABLE_WIN,
} from './sim/scenarios';
import type { DeviceStatus, KhEvent, Live, NewEvent, NewPhoto, Photo, Scan } from './types';

const FW = 'sim-web-0.2.0';
const ZERO4 = [0, 0, 0, 0];
const r2 = (v: number) => Math.round(v * 100) / 100;

interface Session {
  scn: LiveScenario;
  tau: number;
  start: number;
  target: { L: number[]; R: number[] };
  t: number;
  settle: number;
  hist: number[][];
  demoDay?: number;
}

export interface SimOptions {
  /** Milliseconds per simulated second. 1000 = real time. Tests use ~50. */
  tickMs?: number;
  /** 'fast' ≈ 25 simulated seconds, 'real' ≈ 50 (same as app/sim). */
  speed?: 'fast' | 'real';
  /** Random source, injectable for deterministic tests. */
  random?: () => number;
  storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null;
}

export class SimulationSource implements DataSource {
  readonly kind = 'simulation' as const;
  private conn = new Channel<ConnectionState>();
  private status = new Channel<{ status: DeviceStatus | null; online: boolean }>();
  private live = new Channel<Live | null>();
  private scansCh = new Channel<{ scans: Scan[]; rejected: RejectedRecord[] }>();
  private eventsCh = new Channel<KhEvent[]>();
  private photosCh = new Channel<Photo[]>();
  private photos: Photo[] = [];
  private scans: Scan[] = [];
  private events: KhEvent[] = [];
  private hbTimer: ReturnType<typeof setInterval> | null = null;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private sess: Session | null = null;
  private heartbeat = true;
  private seq = 0;
  private readonly tickMs: number;
  private readonly rnd: () => number;
  private readonly store: SimOptions['storage'];
  speed: 'fast' | 'real';

  constructor(
    readonly deviceId: string,
    opts: SimOptions = {},
  ) {
    this.tickMs = opts.tickMs ?? 1000;
    this.speed = opts.speed ?? 'fast';
    this.rnd = opts.random ?? Math.random;
    this.store = opts.storage === undefined ? safeLocalStorage() : opts.storage;
  }

  static readonly liveScenarios = LIVE_SCENARIOS;
  static readonly daysScenarios = DAYS_SCENARIOS;

  serverNow() {
    return Date.now();
  }

  async start() {
    this.load();
    this.conn.emit({ connected: true, ready: true });
    this.emitScans();
    this.emitEvents();
    this.photosCh.emit(this.photos);
    this.beat();
    this.hbTimer = setInterval(() => this.beat(), 10_000);
    this.setLive(idle());
  }

  stop() {
    [this.hbTimer, this.tickTimer].forEach((t) => t && clearInterval(t));
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.sess = null;
    [this.conn, this.status, this.live, this.scansCh, this.eventsCh, this.photosCh].forEach((c) => c.clear());
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

  async writeEvent(e: NewEvent) {
    this.events = [...this.events, { ...e, ts: this.serverNow(), id: this.newId() }];
    this.save();
    this.emitEvents();
  }

  subscribePhotos(cb: (p: Photo[]) => void) {
    return this.photosCh.subscribe(cb);
  }
  async writePhoto(p: NewPhoto) {
    this.photos = [...this.photos, { ...p, ts: this.serverNow(), id: this.newId() }].slice(-12);
    this.save();
    this.photosCh.emit(this.photos);
  }

  /* ---------------- Simulator controls (only used by the simulation panel) ---------------- */

  get scanning() {
    return this.sess !== null;
  }

  setHeartbeat(on: boolean) {
    this.heartbeat = on;
    this.beat();
  }

  /** Starts a simulated stand on the mat. demoDay is set when demo mode is on (each scan = one day). */
  startScan(scenarioId: string, { demoDay }: { demoDay?: number } = {}) {
    if (this.sess) return;
    const scn = LIVE_SCENARIOS.find((s) => s.id === scenarioId) ?? LIVE_SCENARIOS[0]!;
    const real = this.speed === 'real';
    const tau = (scn.wet ? 2.2 : 1) * (real ? 14 : 5);
    const start = scn.wet ? 21.5 : 26.0;
    const target = { L: [...SKIN] as number[], R: SKIN.map((v, i) => v + scn.dR[i]!) };
    if (scn.wet) {
      target.L = target.L.map((v) => v - 1.2);
      target.R = target.R.map((v) => v - 1.2);
    }
    this.sess = { scn, tau, start, target, t: 0, settle: 0, hist: [], demoDay };
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.tick();
    this.tickTimer = setInterval(() => this.tick(), this.tickMs);
  }

  /** Patient steps off before the end: no scan is written. */
  stepOff() {
    if (!this.sess) return;
    this.setLive({ ...idle(), phase: 'error', msg: 'نزل قبل الانتهاء' });
    this.endScan();
  }

  /** Replaces the history with a 30-day scenario (every scan is marked backfill + scenario). */
  loadDays(scenarioId: string) {
    const scn = DAYS_SCENARIOS.find((s) => s.id === scenarioId) ?? DAYS_SCENARIOS[0]!;
    this.scans = generateDays(scn, this.serverNow()).map((s) => ({ ...s, id: this.newId() }));
    this.save();
    this.emitScans();
  }

  clearAll() {
    this.scans = [];
    this.events = [];
    this.save();
    this.emitScans();
    this.emitEvents();
  }

  /* ---------------- internals ---------------- */

  private sensor(foot: 'L' | 'R', i: number): number {
    const s = this.sess!;
    if (s.scn.fault && s.scn.fault.foot === foot && s.scn.fault.i === i) return -127;
    const tgt = s.target[foot][i]!;
    const v = tgt - (tgt - s.start) * Math.exp(-s.settle / s.tau) + (this.rnd() - 0.5) * 0.04;
    return r2(v);
  }

  private tick() {
    const s = this.sess;
    if (!s) return;
    s.t++;
    let fsrL = 2600 + Math.round(this.rnd() * 200);
    let fsrR = 2550 + Math.round(this.rnd() * 200);
    if (s.scn.oneFoot) fsrR = 120 + Math.round(this.rnd() * 60);
    if (s.scn.move && s.t >= 9 && s.t <= 10) fsrL = 400;

    if (s.t <= 2) {
      this.setLive({
        phase: 'placing',
        msg: 'تحقق من الوقوف',
        L: ZERO4,
        R: ZERO4,
        fsrL,
        fsrR,
        standing: false,
        progress: 0,
        elapsedSec: s.t,
      });
      return;
    }
    if (fsrL < FSR_MIN || fsrR < FSR_MIN) {
      if (s.scn.oneFoot || s.t > 12 || !s.scn.move) {
        this.setLive({
          phase: 'error',
          msg: 'قدم وحدة أو القدم مو في مكانها',
          L: ZERO4,
          R: ZERO4,
          fsrL,
          fsrR,
          standing: false,
          progress: 0,
          elapsedSec: s.t,
        });
        return this.endScan();
      }
      s.settle = Math.max(0, s.settle - 4);
      s.hist = [];
      this.setLive({
        phase: 'settling',
        msg: 'اكتُشفت حركة، اثبت',
        L: ZERO4,
        R: ZERO4,
        fsrL,
        fsrR,
        standing: true,
        progress: 0,
        elapsedSec: s.t,
      });
      return;
    }

    s.settle++;
    const L: number[] = [];
    const R: number[] = [];
    for (let i = 0; i < 4; i++) {
      L.push(this.sensor('L', i));
      R.push(this.sensor('R', i));
    }
    s.hist.push(L.concat(R));
    if (s.hist.length > STABLE_WIN) s.hist.shift();
    const stable =
      s.settle >= MIN_SEC &&
      s.hist.length === STABLE_WIN &&
      [...Array(8).keys()].every((k) => {
        const col = s.hist.map((h) => h[k]!).filter((v) => v > -100);
        return !col.length || Math.max(...col) - Math.min(...col) < STABLE_DELTA;
      });
    const progress = Math.min(99, Math.round((s.settle / (s.tau * 4)) * 100));
    this.setLive({ phase: 'settling', L, R, fsrL, fsrR, standing: true, progress, elapsedSec: s.t });

    if (stable || s.t >= MAX_SEC) {
      const diff = L.map((v, i) => (v > -100 && R[i]! > -100 ? r2(R[i]! - v) : -127));
      const faults: string[] = [];
      L.forEach((v, i) => v <= -100 && faults.push('L' + i));
      R.forEach((v, i) => v <= -100 && faults.push('R' + i));
      const scan: Scan = {
        id: this.newId(),
        L,
        R,
        diff,
        standingOk: true,
        stable,
        durationSec: s.t,
        faults,
        source: 'sim',
        firmware: FW,
        scenario: s.scn.id,
        ts: this.serverNow(),
        ...(s.demoDay !== undefined ? { demoDay: s.demoDay } : {}),
      };
      this.scans = [...this.scans, scan];
      this.save();
      this.emitScans();
      this.setLive({
        phase: 'done',
        msg: stable ? 'تم' : 'انتهى الوقت بدون استقرار',
        L,
        R,
        fsrL,
        fsrR,
        standing: true,
        progress: 100,
        elapsedSec: s.t,
      });
      this.endScan();
    }
  }

  private endScan() {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.tickTimer = null;
    this.sess = null;
    this.idleTimer = setTimeout(() => {
      if (!this.sess) this.setLive(idle());
    }, 6 * this.tickMs);
  }

  private beat() {
    const status: DeviceStatus = {
      online: this.heartbeat,
      lastSeen: this.serverNow(),
      firmware: FW,
      source: 'sim',
      rssi: -55,
    };
    this.status.emit({ status, online: this.heartbeat });
  }

  private setLive(l: Live) {
    this.live.emit({ ...l, ts: this.serverNow() });
  }

  private emitScans() {
    this.scansCh.emit({ scans: [...this.scans].sort((a, b) => a.ts - b.ts), rejected: [] });
  }
  private emitEvents() {
    this.eventsCh.emit([...this.events].sort((a, b) => a.ts - b.ts));
  }

  private newId() {
    return `sim-${Date.now().toString(36)}-${(this.seq++).toString(36)}`;
  }

  private get key() {
    return `kh.sim.${this.deviceId}`;
  }
  private load() {
    try {
      const raw = this.store?.getItem(this.key);
      if (!raw) return;
      const d = JSON.parse(raw) as { scans?: Scan[]; events?: KhEvent[]; photos?: Photo[] };
      this.photos = Array.isArray(d.photos) ? d.photos : [];
      this.scans = Array.isArray(d.scans) ? d.scans : [];
      this.events = Array.isArray(d.events) ? d.events : [];
    } catch {
      /* private mode or corrupt data: start empty */
    }
  }
  private save() {
    try {
      this.store?.setItem(
        this.key,
        JSON.stringify({ scans: this.scans, events: this.events, photos: this.photos }),
      );
    } catch {
      /* storage full or blocked: keep in memory only */
    }
  }
}

function idle(): Live {
  return { phase: 'idle', L: ZERO4, R: ZERO4, fsrL: 0, fsrR: 0, standing: false, progress: 0, elapsedSec: 0 };
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}
