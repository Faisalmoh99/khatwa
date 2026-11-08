/**
 * The ESP32 JSON must match the data contract exactly (the database rules reject any missing or extra field).
 * Compiles firmware/test/test_core.cpp with the host C++ compiler, runs it in --samples mode (same builders
 * as the firmware), and validates every line with the app's zod schemas in strict mode.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';
import { LiveSchema, ScanSchema, SerialLineSchema, StatusSchema } from './types';
import { checkScan } from '@/lib/rules/rules';
import { parseSerialLine } from './SerialSource';

const fw = fileURLToPath(new URL('../../../firmware', import.meta.url));
const cxx = ['g++', 'clang++'].find((c) => {
  try {
    execFileSync(c, ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
});

function samples(): { kind: string; json: Record<string, unknown> }[] {
  const out = join(mkdtempSync(join(tmpdir(), 'kh-fw-')), 'test_core');
  execFileSync(cxx!, [
    '-std=c++17',
    '-Wall',
    '-Wextra',
    '-Werror',
    `-I${fw}/khatwa_esp32`,
    `${fw}/test/test_core.cpp`,
    '-o',
    out,
  ]);
  execFileSync(out); // the C++ unit tests must pass first (exit 1 on failure)
  return execFileSync(out, ['--samples'], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .map((l) => {
      const i = l.indexOf(' ');
      return { kind: l.slice(0, i), json: JSON.parse(l.slice(i + 1)) as Record<string, unknown> };
    });
}

/** Firebase replaces {".sv":"timestamp"} with the server time; do the same before validating. */
const resolveTs = (o: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(o).map(([k, v]) => [k, v && typeof v === 'object' && '.sv' in v ? Date.now() : v]),
  );

describe.skipIf(!cxx)('firmware JSON matches the data contract', () => {
  const all = cxx ? samples() : [];

  test('there are samples of every kind', () => {
    expect(new Set(all.map((s) => s.kind))).toEqual(new Set(['status', 'live', 'scan', 'serial']));
  });

  test('status: strict schema', () => {
    for (const s of all.filter((x) => x.kind === 'status')) {
      expect(s.json.lastSeen).toEqual({ '.sv': 'timestamp' });
      expect(StatusSchema.strict().parse(resolveTs(s.json))).toMatchObject({ source: 'esp32', online: true });
    }
  });

  test('live: strict schema for idle, placing, settling, done and error', () => {
    const phases = all
      .filter((x) => x.kind === 'live')
      .map((s) => LiveSchema.strict().parse(resolveTs(s.json)).phase);
    expect(new Set(phases)).toEqual(new Set(['idle', 'placing', 'settling', 'done', 'error']));
  });

  test('scan: strict schema, accepted by the app rule engine, faults as -127', () => {
    const scans = all
      .filter((x) => x.kind === 'scan')
      .map((s) => ScanSchema.strict().parse(resolveTs(s.json)));
    expect(scans).toHaveLength(3);
    const [withFault, withNtpTime, timedOut] = scans;
    expect(withFault!.L[2]).toBe(-127);
    expect(withFault!.faults).toEqual(['L2']);
    expect(checkScan(withFault!).ok).toBe(true);
    expect(checkScan(withFault!).flagged).toEqual([1]);
    expect(withNtpTime!.ts).toBe(1762750000123);
    expect(timedOut!.stable).toBe(false);
    expect(checkScan(timedOut!).ok).toBe(false);
  });

  test('USB line: strict schema and understood by the app', () => {
    const line = all.find((x) => x.kind === 'serial')!;
    expect(SerialLineSchema.strict().parse(line.json).L[1]).toBe(-127);
    expect(parseSerialLine(JSON.stringify(line.json))).not.toBeNull();
  });
});
