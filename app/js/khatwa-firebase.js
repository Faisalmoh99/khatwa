// خطوة — طبقة الاتصال بـ Firebase Realtime Database
// يستخدمها التطبيق والمحاكي وصفحة الفحص. شكل البيانات موثّق في docs/DATA_SCHEMA.md

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  getDatabase, ref, onValue, set, update, push, remove, serverTimestamp,
  query, orderByChild, limitToLast,
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js';
import { firebaseConfig, DEVICE_ID } from './firebase-config.js';

export const ONLINE_WINDOW_MS = 60000;   // الجهاز «متصل» إذا آخر نبضة أقل من دقيقة

let _app, _db, _auth, _ready;

export function configured() {
  return firebaseConfig.apiKey && !firebaseConfig.apiKey.startsWith('REPLACE');
}

/** يتصل ويسجّل دخول مجهول. يرجع Promise تنتهي لما يصير جاهز */
export function init() {
  if (_ready) return _ready;
  if (!configured()) return Promise.reject(new Error('عبّئ app/js/firebase-config.js أول'));
  _app = initializeApp(firebaseConfig);
  _db = getDatabase(_app);
  _auth = getAuth(_app);
  _ready = new Promise((resolve, reject) => {
    const off = onAuthStateChanged(_auth, u => { if (u) { off(); resolve({ uid: u.uid }); } });
    signInAnonymously(_auth).catch(reject);
  });
  return _ready;
}

export const path = (sub = '', dev = DEVICE_ID) => `devices/${dev}${sub ? '/' + sub : ''}`;
export const ts = serverTimestamp;

/** فرق ساعة الجهاز عن ساعة السيرفر (عشان نحسب «متصل» صح حتى لو ساعة الجوال غلط) */
let serverOffset = 0;
export function serverNow() { return Date.now() + serverOffset; }

/**
 * يشترك في بيانات الجهاز.
 * handlers: { onStatus(status, online), onLive(live), onScans(obj), onEvents(obj) }
 * يرجع دالة لإلغاء الاشتراك.
 */
export function subscribe(handlers, dev = DEVICE_ID) {
  const offs = [];
  offs.push(onValue(ref(_db, '.info/serverTimeOffset'), s => { serverOffset = s.val() || 0; }));
  let lastStatus = null;
  const emitStatus = () => {
    if (!handlers.onStatus) return;
    const online = !!(lastStatus && lastStatus.online && lastStatus.lastSeen && serverNow() - lastStatus.lastSeen < ONLINE_WINDOW_MS);
    handlers.onStatus(lastStatus, online);
  };
  offs.push(onValue(ref(_db, path('status', dev)), s => { lastStatus = s.val(); emitStatus(); }));
  const t = setInterval(emitStatus, 5000);
  offs.push(() => clearInterval(t));
  if (handlers.onLive) offs.push(onValue(ref(_db, path('live', dev)), s => handlers.onLive(s.val())));
  if (handlers.onScans) offs.push(onValue(query(ref(_db, path('scans', dev)), orderByChild('ts'), limitToLast(300)), s => handlers.onScans(s.val() || {})));
  if (handlers.onEvents) offs.push(onValue(query(ref(_db, path('events', dev)), orderByChild('ts'), limitToLast(200)), s => handlers.onEvents(s.val() || {})));
  return () => offs.forEach(f => f());
}

// ---------- كتابة (يستخدمها المحاكي، والتطبيق للأحداث) ----------
export const writeStatus = (obj, dev) => update(ref(_db, path('status', dev)), { ...obj, lastSeen: serverTimestamp() });
export const writeLive = (obj, dev) => set(ref(_db, path('live', dev)), { ...obj, ts: serverTimestamp() });
export const pushScan = (obj, dev) => push(ref(_db, path('scans', dev)), { ...obj, ts: serverTimestamp() });
/** للمحاكي فقط: قراءة بوقت قديم (backfill) */
export const pushScanAt = (obj, tsMs, dev) => push(ref(_db, path('scans', dev)), { ...obj, ts: tsMs });
/** حدث من التطبيق: فحص سريع، علامة خطر، إقرار عائلة/عيادة... */
export const pushEvent = (obj, dev) => push(ref(_db, path('events', dev)), { ...obj, ts: serverTimestamp() });
export const clearScans = dev => remove(ref(_db, path('scans', dev)));
export const clearEvents = dev => remove(ref(_db, path('events', dev)));
