// إعدادات Firebase للتطبيق والمحاكي.
// انسخها من: Firebase Console ← Project settings ← Your apps ← Web app ← SDK setup and configuration ← Config
// هذي القيم مو سرّية (تظهر في أي موقع يستخدم Firebase). الحماية تكون بقواعد قاعدة البيانات.
// لا تحط هنا كلمة مرور حساب الجهاز. تلك في firmware/khatwa_esp32/secrets.h فقط.

export const firebaseConfig = {
  apiKey: 'REPLACE_ME',
  authDomain: 'REPLACE_ME.firebaseapp.com',
  databaseURL: 'https://REPLACE_ME-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'REPLACE_ME',
  appId: 'REPLACE_ME',
};

export const DEVICE_ID = 'khatwa-01';
