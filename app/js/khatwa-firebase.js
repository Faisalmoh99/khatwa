// خطوة — طبقة الاتصال بـ Firebase Realtime Database
// يستخدمها التطبيق والمحاكي وصفحة الفحص. شكل البيانات موثّق في docs/DATA_SCHEMA.md

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getAuth, initializeAuth, inMemoryPersistence, signInAnonymously, signInWithEmailAndPassword, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
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

function ensureApp() {
  if (_app) return;
  if (!configured()) throw new Error('عبّئ app/js/firebase-config.js أول');
  _app = initializeApp(firebaseConfig);
  _db = getDatabase(_app);
  _auth = getAuth(_app);
}

/** يتصل ويسجّل دخول مجهول (قراءة + أحداث). يعيد المحاولة لو فشل (ملاحظة المراجعة R6). */
export function init() {
  if (_ready) return _ready;
  try { ensureApp(); } catch (e) { return Promise.reject(e); }
  _ready = new Promise((resolve, reject) => {
    const off = onAuthStateChanged(_auth, u => { if (u) { off(); resolve({ uid: u.uid }); } });
    const attempt = n => signInAnonymously(_auth).catch(err => {
      if (n >= 4) { _ready = null; reject(err); return; }
      setTimeout(() => attempt(n + 1), 1000 * 2 ** n);
    });
    attempt(0);
  });
  return _ready;
}

/**
 * دخول بحساب الجهاز (للمحاكي): قواعد قاعدة البيانات تسمح بكتابة status/live/scans لهذا الحساب فقط.
 * كلمة المرور يكتبها المستخدم في الصفحة، وما تنحفظ في الكود.
 */
export function initDevice(email, password) {
  if (!configured()) return Promise.reject(new Error('عبّئ app/js/firebase-config.js أول'));
  // نسخة Firebase مستقلة وجلسة في الذاكرة فقط: ما تتداخل مع دخول التطبيق المجهول في نفس المتصفح،
  // وما تنحفظ جلسة حساب الجهاز في المتصفح.
  if (!_app) {
    _app = initializeApp(firebaseConfig, 'khatwa-device');
    _auth = initializeAuth(_app, { persistence: inMemoryPersistence });
    _db = getDatabase(_app);
  }
  _ready = signInWithEmailAndPassword(_auth, email, password).then(c => ({ uid: c.user.uid }));
  _ready.catch(() => { _ready = null; });
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
