/**
 * Checks what a device (ESP32 or simulator) has written to Firebase against docs/DATA_SCHEMA.md.
 * Read-only. Usage:  npm run check:device [-- --dev khatwa-01]
 * Prints ✅ / ❌ per field so a firmware mistake is found in a minute.
 */
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously } from 'firebase/auth';
import { get, getDatabase, limitToLast, onValue, orderByChild, query, ref } from 'firebase/database';

const config = {
  apiKey: 'AIzaSyCb_d9YOBFmlbC31V-hU3WAWDPT_ebRSlo',
  authDomain: 'khatwa-foe2t.firebaseapp.com',
  databaseURL: 'https://khatwa-foe2t-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'khatwa-foe2t',
};
const argDev = process.argv.indexOf('--dev');
const DEV = argDev > 0 ? process.argv[argDev + 1] : 'khatwa-01';

let failures = 0;
const ok = (cond, label, detail = '') => {
  console.log(`${cond ? '✅' : '❌'} ${label}${detail ? `  (${detail})` : ''}`);
  if (!cond) failures++;
};
const arr = (v) =>
  Array.isArray(v)
    ? v
    : v && typeof v === 'object'
      ? Object.keys(v)
          .sort((a, b) => a - b)
          .map((k) => v[k])
      : null;
const four = (v) => {
  const a = arr(v);
  return !!a && a.length === 4 && a.every((x) => typeof x === 'number' && Number.isFinite(x));
};

const app = initializeApp(config);
await signInAnonymously(getAuth(app));
const db = getDatabase(app);
const offset = await new Promise((resolve) => {
  const off = onValue(ref(db, '.info/serverTimeOffset'), (s) => {
    off();
    resolve(Number(s.val()) || 0);
  });
});
const now = Date.now() + offset;
const base = `devices/${DEV}`;
console.log(`\nDevice: ${DEV}\n`);

console.log('— status —');
const status = (await get(ref(db, `${base}/status`))).val();
ok(!!status, 'status exists');
if (status) {
  ok(typeof status.lastSeen === 'number', 'lastSeen is a server timestamp (number)', String(status.lastSeen));
  const age = Math.round((now - status.lastSeen) / 1000);
  ok(age < 60, 'online (heartbeat < 60 s)', `${age} s ago`);
  ok(typeof status.firmware === 'string', 'firmware string', status.firmware);
  ok(['esp32', 'sim'].includes(status.source), 'source is esp32|sim', status.source);
}

console.log('\n— live —');
const live = (await get(ref(db, `${base}/live`))).val();
ok(!!live, 'live exists');
if (live) {
  ok(['idle', 'placing', 'settling', 'done', 'error'].includes(live.phase), 'phase known', live.phase);
  ok(four(live.L) && four(live.R), 'L and R are 4 numbers', JSON.stringify([arr(live.L), arr(live.R)]));
  ok(typeof live.ts === 'number', 'ts number');
  if (live.fsrL !== undefined)
    ok(
      live.fsrL >= 0 && live.fsrL <= 4095 && live.fsrR >= 0 && live.fsrR <= 4095,
      'fsrL/fsrR in 0–4095',
      `${live.fsrL}/${live.fsrR}`,
    );
}

console.log('\n— last 3 scans —');
const snap = (await get(query(ref(db, `${base}/scans`), orderByChild('ts'), limitToLast(3)))).val() || {};
const scans = Object.entries(snap).sort((a, b) => a[1].ts - b[1].ts);
ok(scans.length > 0, 'at least one scan', `${scans.length}`);
for (const [id, s] of scans) {
  console.log(`  scan ${id}  source=${s.source} ${s.backfill ? '(backfill)' : ''}`);
  ok(four(s.L) && four(s.R), '  L and R are 4 numbers');
  ok(
    !arr(s.L)?.some((v) => v === null) && !arr(s.R)?.some((v) => v === null),
    '  no null inside arrays (fault = -127)',
  );
  ok(typeof s.stable === 'boolean', '  stable is boolean');
  ok(typeof s.standingOk === 'boolean', '  standingOk is boolean');
  ok(typeof s.ts === 'number' && s.ts <= now + 60000, '  ts number, not in the future');
  ok(Array.isArray(s.faults) || s.faults === undefined, '  faults is a list');
}

console.log(`\n${failures === 0 ? '✅ All checks passed.' : `❌ ${failures} check(s) failed.`}`);
process.exit(failures ? 1 : 0);
