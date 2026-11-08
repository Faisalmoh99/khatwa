/**
 * Firebase Realtime Database rules tests (emulator). Run from the repo root:
 *   firebase emulators:exec --only database --project demo-khatwa "node web/scripts/test-rules.mjs"
 * Rules must pass all cases before `firebase deploy --only database`.
 */
import { readFileSync } from 'node:fs';
import { after, before, beforeEach, test } from 'node:test';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { get, push, ref, remove, serverTimestamp, set, update } from 'firebase/database';

const DEVICE_UID = 'J3rETaXXaDQS2GkWg9PHH4OcX1a2';
const D = 'devices/khatwa-01';
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
      rules: readFileSync(new URL('../../firebase/database.rules.json', import.meta.url), 'utf8'),
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
