/**
 * Turns a stream of raw readings (USB serial) into live phases and a finished scan,
 * using the same rules as the firmware and simulator (docs/DATA_SCHEMA.md "Stability"):
 * both heel sensors pressed, every sensor changes < 0.1°C over the last 5 s, at least 8 s, max 90 s.
 */
import { FSR_MIN, FSR_ON, MAX_SEC, MIN_SEC, STABLE_DELTA, STABLE_WIN } from './sim/scenarios';
import type { Live, Scan } from './types';

export interface RawSample {
  /** seconds (monotonic) */
  t: number;
  L: number[];
  R: number[];
  fsrL?: number;
  fsrR?: number;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const ZERO4 = [0, 0, 0, 0];

export class StabilityTracker {
  private startT: number | null = null;
  private hist: RawSample[] = [];
  private finished = false;

  reset() {
    this.startT = null;
    this.hist = [];
    this.finished = false;
  }

  /** Feed one sample. Returns the live frame, and a scan when the measurement completes. */
  push(s: RawSample): { live: Live; scan?: Omit<Scan, 'id' | 'ts' | 'source' | 'firmware'> } {
    const hasFsr = s.fsrL !== undefined && s.fsrR !== undefined;
    const fsrL = s.fsrL ?? 0;
    const fsrR = s.fsrR ?? 0;
    const pressed = !hasFsr || (fsrL > FSR_ON && fsrR > FSR_ON);
    const released = hasFsr && (fsrL < FSR_MIN || fsrR < FSR_MIN);

    if (this.startT === null) {
      if (!pressed)
        return {
          live: {
            phase: 'idle',
            L: ZERO4,
            R: ZERO4,
            fsrL,
            fsrR,
            standing: false,
            progress: 0,
            elapsedSec: 0,
          },
        };
      this.startT = s.t;
      this.finished = false;
    }
    if (this.finished) {
      if (released) this.reset();
      return {
        live: {
          phase: 'done',
          L: s.L,
          R: s.R,
          fsrL,
          fsrR,
          standing: !released,
          progress: 100,
          elapsedSec: 0,
        },
      };
    }
    const elapsed = Math.round(s.t - this.startT);
    if (released) {
      this.reset();
      return {
        live: {
          phase: 'error',
          msg: 'قدم وحدة أو القدم مو في مكانها',
          L: ZERO4,
          R: ZERO4,
          fsrL,
          fsrR,
          standing: false,
          progress: 0,
          elapsedSec: elapsed,
        },
      };
    }
    this.hist.push(s);
    this.hist = this.hist.filter((h) => s.t - h.t <= STABLE_WIN);
    const span = s.t - (this.hist[0]?.t ?? s.t);
    const stable =
      elapsed >= MIN_SEC &&
      span >= STABLE_WIN - 1 &&
      [...Array(8).keys()].every((k) => {
        const col = this.hist.map((h) => (k < 4 ? h.L[k]! : h.R[k - 4]!)).filter((v) => v > -100);
        return !col.length || Math.max(...col) - Math.min(...col) < STABLE_DELTA;
      });
    const progress = Math.min(99, Math.round((elapsed / 30) * 100));
    const live: Live = {
      phase: 'settling',
      L: s.L,
      R: s.R,
      fsrL,
      fsrR,
      standing: true,
      progress,
      elapsedSec: elapsed,
    };
    if (stable || elapsed >= MAX_SEC) {
      this.finished = true;
      const faults: string[] = [];
      s.L.forEach((v, i) => v <= -100 && faults.push('L' + i));
      s.R.forEach((v, i) => v <= -100 && faults.push('R' + i));
      return {
        live: { ...live, phase: 'done', progress: 100, msg: stable ? 'تم' : 'انتهى الوقت بدون استقرار' },
        scan: {
          L: s.L,
          R: s.R,
          diff: s.L.map((v, i) => (v > -100 && s.R[i]! > -100 ? r2(s.R[i]! - v) : -127)),
          standingOk: true,
          stable,
          durationSec: elapsed,
          faults,
        },
      };
    }
    return { live };
  }
}
