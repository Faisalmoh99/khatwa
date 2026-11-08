/**
 * Confirms the device account signs in and its uid matches the one in firebase/database.rules.json.
 * Credentials come from env (KH_DEVICE_EMAIL, KH_DEVICE_PASSWORD) and are never printed.
 */
import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const rules = readFileSync(new URL('../../firebase/database.rules.json', import.meta.url), 'utf8');
const expected = rules.match(/auth\.uid === '([^']+)'/)?.[1];
const { KH_DEVICE_EMAIL: email, KH_DEVICE_PASSWORD: password } = process.env;
if (!email || !password) {
  console.error('Set KH_DEVICE_EMAIL and KH_DEVICE_PASSWORD.');
  process.exit(2);
}
const app = initializeApp({
  apiKey: 'AIzaSyCb_d9YOBFmlbC31V-hU3WAWDPT_ebRSlo',
  authDomain: 'khatwa-foe2t.firebaseapp.com',
  projectId: 'khatwa-foe2t',
});
try {
  const c = await signInWithEmailAndPassword(getAuth(app), email, password);
  const ok = c.user.uid === expected;
  console.log(
    ok
      ? '✅ device account signs in and its uid matches the rules'
      : '❌ device account uid does NOT match the rules',
  );
  process.exit(ok ? 0 : 1);
} catch (e) {
  console.log(`❌ device account sign-in failed: ${e.code ?? e.message}`);
  process.exit(1);
}
