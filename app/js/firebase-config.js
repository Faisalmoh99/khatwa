// إعدادات Firebase للتطبيق والمحاكي.
// انسخها من: Firebase Console ← Project settings ← Your apps ← Web app ← SDK setup and configuration ← Config
// هذي القيم مو سرّية (تظهر في أي موقع يستخدم Firebase). الحماية تكون بقواعد قاعدة البيانات.
// لا تحط هنا كلمة مرور حساب الجهاز. تلك في firmware/khatwa_esp32/secrets.h فقط.

export const firebaseConfig = {
  apiKey: 'AIzaSyCb_d9YOBFmlbC31V-hU3WAWDPT_ebRSlo',
  authDomain: 'khatwa-foe2t.firebaseapp.com',
  databaseURL: 'https://khatwa-foe2t-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'khatwa-foe2t',
  storageBucket: 'khatwa-foe2t.firebasestorage.app',
  messagingSenderId: '320925984448',
  appId: '1:320925984448:web:bbf63b11b2a2601101ef25',
};

export const DEVICE_ID = 'khatwa-01';
