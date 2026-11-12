/**
 * Firebase Realtime Database rules tests (emulator). Run from the repo root:
 *   firebase emulators:exec --only database --project demo-khatwa "node web/scripts/test-rules.mjs"
 * Rules must pass all cases before `firebase deploy --only database`.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { after, before, beforeEach, test } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { get, push, ref, remove, serverTimestamp, set, update } from 'firebase/database';

const DEVICE_UID = 'J3rETaXXaDQS2GkWg9PHH4OcX1a2';
const D = 'devices/khatwa-01';
const DEMO = 'devices/khatwa-demo';
// The virtual mat's account (Wokwi, public credentials): read from the rules so the tests follow the deploy.
const RULES_TEXT = readFileSync(new URL('../../firebase/database.rules.json', import.meta.url), 'utf8');
const DEMO_UID = RULES_TEXT.match(/auth\.uid === '([^']+)' && \$dev === 'khatwa-demo'/)[1];
let env;

const scan = (extra = {}) => ({
  L: [30.8, 31.2, 30.6, 29.9],
  R: [30.9, 33.8, 30.8, 29.9],
  diff: [0.1, 2.6, 0.2, 0],
  standingOk: true,
  stable: true,
  durationSec: 31,
  faults: [],
  source: 'esp32',
  firmware: '0.1.0',
  ts: serverTimestamp(),
  ...extra,
});
const event = (extra = {}) => ({
  kind: 'quickcheck',
  data: { skin: 'wound', pain: 'ok', care: 'done' },
  day: '2026-11-10',
  ts: serverTimestamp(),
  ...extra,
});
const tinyJpeg = 'data:image/jpeg;base64,' + 'A'.repeat(1000);

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-khatwa',
    database: {
      rules: RULES_TEXT,
      host: '127.0.0.1',
      port: 9000,
    },
  });
});
beforeEach(async () => env.clearDatabase());
after(async () => env.cleanup());

const device = () => env.authenticatedContext(DEVICE_UID).database();
const visitor = () => env.authenticatedContext('anon-visitor').database();
const nobody = () => env.unauthenticatedContext().database();
const demo = () => env.authenticatedContext(DEMO_UID).database();

/** Status, live and scan exactly as the firmware sends them (same as the samples of test 15). */
async function firmwareSamples() {
  const fw = new URL('../../firmware/', import.meta.url).pathname;
  const bin = join(mkdtempSync(join(tmpdir(), 'kh-fw-')), 'test_core');
  execFileSync('g++', ['-std=c++17', `-I${fw}khatwa_esp32`, `${fw}test/test_core.cpp`, '-o', bin]);
  return execFileSync(bin, ['--samples'], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .map((line) => {
      const i = line.indexOf(' ');
      return { kind: line.slice(0, i), json: JSON.parse(line.slice(i + 1)) };
    });
}
const liveFrame = (extra = {}) => ({
  phase: 'settling',
  L: [30.1, 30.6, 30.3, 29.8],
  R: [30.2, 33.2, 30.4, 29.9],
  fsrL: 2600,
  fsrR: 2550,
  standing: true,
  progress: 40,
  elapsedSec: 12,
  ts: serverTimestamp(),
  ...extra,
});

test('1. anonymous visitor cannot write device status', async () => {
  await assertFails(update(ref(visitor(), `${D}/status`), { online: true, lastSeen: serverTimestamp() }));
});
test('2. device account can write status (heartbeat)', async () => {
  await assertSucceeds(
    update(ref(device(), `${D}/status`), {
      online: true,
      firmware: 'sim-0.1.0',
      source: 'sim',
      rssi: -55,
      lastSeen: serverTimestamp(),
    }),
  );
});
test('3. anonymous visitor cannot push a scan (no forged readings)', async () => {
  await assertFails(push(ref(visitor(), `${D}/scans`), scan()));
});
test('4. device account can push a valid scan, incl. -127 fault and backfill fields', async () => {
  await assertSucceeds(
    push(
      ref(device(), `${D}/scans`),
      scan({
        L: [-127, 31.2, 30.6, 29.9],
        diff: [-127, 2.6, 0.2, 0],
        faults: ['L0'],
        source: 'sim',
        backfill: true,
        scenario: 'hot',
        demoDay: 2,
      }),
    ),
  );
});
test('5. a scan cannot be modified once written (append only)', async () => {
  const r = await push(ref(device(), `${D}/scans`), scan());
  await assertFails(update(ref(device(), `${D}/scans/${r.key}`), { stable: false }));
});
test('6. scans cannot be deleted, not even by the device', async () => {
  const r = await push(ref(device(), `${D}/scans`), scan());
  await assertFails(remove(ref(device(), `${D}/scans/${r.key}`)));
  await assertFails(remove(ref(device(), `${D}/scans`)));
});
test('7. scan without stable is rejected (R7)', async () => {
  const s = scan();
  delete s.stable;
  await assertFails(push(ref(device(), `${D}/scans`), s));
});
test('8. scan with a non-numeric temperature is rejected (R7)', async () => {
  await assertFails(push(ref(device(), `${D}/scans`), scan({ L: [30.8, '31.2', 30.6, 29.9] })));
  await assertFails(push(ref(device(), `${D}/scans`), scan({ R: [30, 31, 30] })));
});
test('9. scan with an extra field is rejected', async () => {
  await assertFails(push(ref(device(), `${D}/scans`), scan({ hacked: true })));
});
test('10. signed-in app user can append a valid event; unknown kind or extra field rejected', async () => {
  await assertSucceeds(push(ref(visitor(), `${D}/events`), event()));
  await assertSucceeds(
    push(
      ref(visitor(), `${D}/events`),
      event({
        kind: 'escalation',
        data: { key: 'k', to: 'clinic', level: 4, reason: 'red', why: 'جرح', urgent: true },
      }),
    ),
  );
  await assertSucceeds(
    push(
      ref(visitor(), `${D}/events`),
      event({ kind: 'photo', data: { role: 'today', site: { foot: 'R', i: 1 } } }),
    ),
  );
  await assertFails(push(ref(visitor(), `${D}/events`), event({ kind: 'drop_table' })));
  await assertFails(push(ref(visitor(), `${D}/events`), event({ extra: 1 })));
});
test('11. events cannot be modified or deleted', async () => {
  const r = await push(ref(visitor(), `${D}/events`), event());
  await assertFails(set(ref(visitor(), `${D}/events/${r.key}/kind`), 'mode'));
  await assertFails(remove(ref(visitor(), `${D}/events/${r.key}`)));
  await assertFails(remove(ref(device(), `${D}/events`)));
});
test('12. photos: thumbnail accepted, too large or not JPEG rejected', async () => {
  await assertSucceeds(
    push(ref(visitor(), `${D}/photos`), {
      role: 'today',
      jpeg: tinyJpeg,
      day: '2026-11-10',
      site: { foot: 'L', i: 3 },
      ts: serverTimestamp(),
    }),
  );
  await assertFails(
    push(ref(visitor(), `${D}/photos`), {
      role: 'today',
      jpeg: 'data:image/jpeg;base64,' + 'A'.repeat(95_000),
      ts: serverTimestamp(),
    }),
  );
  await assertFails(
    push(ref(visitor(), `${D}/photos`), {
      role: 'today',
      jpeg: 'data:image/png;base64,AAAA',
      ts: serverTimestamp(),
    }),
  );
});
test('13. live: device writes a valid frame; bad phase or visitor rejected', async () => {
  const frame = {
    phase: 'settling',
    L: [30, 31, 30, 29],
    R: [30, 31, 30, 29],
    fsrL: 2600,
    fsrR: 2500,
    standing: true,
    progress: 40,
    elapsedSec: 9,
    ts: serverTimestamp(),
  };
  await assertSucceeds(set(ref(device(), `${D}/live`), frame));
  await assertFails(set(ref(device(), `${D}/live`), { ...frame, phase: 'dancing' }));
  await assertFails(set(ref(visitor(), `${D}/live`), frame));
});
test('14. reads need sign-in; fake device ids and unknown paths rejected', async () => {
  await assertSucceeds(get(ref(visitor(), `${D}/scans`)));
  await assertFails(get(ref(nobody(), `${D}/scans`)));
  await assertFails(push(ref(visitor(), 'devices/hacker device/events'), event()));
  await assertFails(set(ref(device(), `${D}/whatever`), 1));
  await assertFails(set(ref(visitor(), 'other/path'), 1));
});

test('15. JSON built by the ESP32 firmware code is accepted as written (status, live, scans)', async () => {
  const db = device();
  for (const { kind, json } of await firmwareSamples()) {
    if (kind === 'status') await assertSucceeds(update(ref(db, `${D}/status`), json));
    if (kind === 'live') await assertSucceeds(set(ref(db, `${D}/live`), json));
    if (kind === 'scan') await assertSucceeds(push(ref(db, `${D}/scans`), json));
  }
});

/* ---------- Virtual mat (Wokwi): demo account, public credentials ---------- */

test('16. demo account writes the firmware JSON to khatwa-demo (status, live, scans)', async () => {
  const db = demo();
  for (const { kind, json } of await firmwareSamples()) {
    if (kind === 'status') await assertSucceeds(update(ref(db, `${DEMO}/status`), json));
    if (kind === 'live') await assertSucceeds(set(ref(db, `${DEMO}/live`), json));
    if (kind !== 'scan') continue;
    // An offline-queued scan carries its NTP time: accepted within 24 h, older is refused.
    if (typeof json.ts === 'number' && json.ts < Date.now() - 86_400_000) {
      await assertFails(push(ref(db, `${DEMO}/scans`), json));
      await assertSucceeds(push(ref(db, `${DEMO}/scans`), { ...json, ts: Date.now() - 3_600_000 }));
    } else await assertSucceeds(push(ref(db, `${DEMO}/scans`), json));
  }
});

test('17. demo account cannot write khatwa-01 (or any other device), anywhere', async () => {
  const db = demo();
  for (const dev of [D, 'devices/khatwa-test', 'devices/khatwa-e2e']) {
    await assertFails(update(ref(db, `${dev}/status`), { online: true, lastSeen: serverTimestamp() }));
    await assertFails(set(ref(db, `${dev}/live`), liveFrame()));
    await assertFails(push(ref(db, `${dev}/scans`), scan()));
    await assertFails(push(ref(db, `${dev}/events`), event()));
    await assertFails(
      push(ref(db, `${dev}/photos`), { role: 'today', jpeg: tinyJpeg, ts: serverTimestamp() }),
    );
    await assertFails(set(ref(db, `${dev}/calibration`), { L: [0, 0, 0, 0] }));
  }
});

test('18. demo account cannot write events, photos or calibration even on khatwa-demo', async () => {
  const db = demo();
  await assertFails(push(ref(db, `${DEMO}/events`), event()));
  await assertFails(
    push(ref(db, `${DEMO}/photos`), { role: 'today', jpeg: tinyJpeg, ts: serverTimestamp() }),
  );
  await assertFails(set(ref(db, `${DEMO}/calibration`), { L: [0, 0, 0, 0] }));
});

test('19. khatwa-demo: shape and size are enforced (public credentials)', async () => {
  const db = demo();
  // valid baseline
  await assertSucceeds(set(ref(db, `${DEMO}/live`), liveFrame()));
  await assertSucceeds(push(ref(db, `${DEMO}/scans`), scan({ faults: ['L0'] })));
  // out-of-range temperatures, huge numbers, extra fields, oversized strings
  await assertFails(set(ref(db, `${DEMO}/live`), liveFrame({ L: [30, 30, 30, 1e9] })));
  await assertFails(push(ref(db, `${DEMO}/scans`), scan({ R: [30, 30, 30, -60] })));
  await assertFails(push(ref(db, `${DEMO}/scans`), scan({ diff: [0, 0, 0, 500] })));
  await assertFails(set(ref(db, `${DEMO}/live`), liveFrame({ elapsedSec: 99999 })));
  await assertFails(set(ref(db, `${DEMO}/live`), liveFrame({ msg: 'x'.repeat(81) })));
  await assertFails(set(ref(db, `${DEMO}/live`), liveFrame({ junk: 1 })));
  await assertFails(push(ref(db, `${DEMO}/scans`), scan({ firmware: 'x'.repeat(33) })));
  await assertFails(update(ref(db, `${DEMO}/status`), { lastSeen: serverTimestamp(), rssi: 5000 }));
  // no fault-list stuffing, no scans back-dated by more than a day, no simulator-only fields from the device
  await assertFails(push(ref(db, `${DEMO}/scans`), scan({ faults: Array(9).fill('L0') })));
  await assertFails(push(ref(db, `${DEMO}/scans`), scan({ ts: Date.now() - 2 * 86_400_000 })));
  await assertFails(push(ref(db, `${DEMO}/scans`), scan({ demoDay: 2 })));
  await assertFails(push(ref(db, `${DEMO}/scans`), scan({ backfill: true })));
  // the root of the device and unknown children
  await assertFails(set(ref(db, DEMO), { status: { lastSeen: serverTimestamp() } }));
  await assertFails(set(ref(db, `${DEMO}/whatever`), 'x'.repeat(10_000)));
  // append only, no deletes
  const r = push(ref(db, `${DEMO}/scans`), scan());
  await assertSucceeds(r);
  await assertFails(set(r.ref, scan({ stable: false })));
  await assertFails(remove(ref(db, `${DEMO}/scans`)));
});

test('20. real device account is unchanged: still writes khatwa-01, khatwa-test and khatwa-demo', async () => {
  const db = device();
  for (const dev of [D, 'devices/khatwa-test', DEMO]) {
    await assertSucceeds(update(ref(db, `${dev}/status`), { online: true, lastSeen: serverTimestamp() }));
    await assertSucceeds(set(ref(db, `${dev}/live`), liveFrame()));
    await assertSucceeds(push(ref(db, `${dev}/scans`), scan()));
  }
  // khatwa-01 keeps the old, looser value checks for the real device (no new limits there)
  await assertSucceeds(push(ref(db, `${D}/scans`), scan({ diff: [0, 0, 0, 500] })));
  await assertSucceeds(set(ref(db, `${D}/calibration`), { L: [0, 0, 0, 0] }));
  // visitors can still append events to khatwa-01 (the patient app), demo cannot
  await assertSucceeds(push(ref(visitor(), `${D}/events`), event()));
});
