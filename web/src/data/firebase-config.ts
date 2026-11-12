// Firebase web config. These values are NOT secret (they ship in every Firebase web app).
// Protection comes from the database rules. Same values as app/js/firebase-config.js.
// Never put the device account password here. It lives only in firmware/khatwa_esp32/secrets.h.

export const firebaseConfig = {
  apiKey: 'AIzaSyCb_d9YOBFmlbC31V-hU3WAWDPT_ebRSlo',
  authDomain: 'khatwa-foe2t.firebaseapp.com',
  databaseURL: 'https://khatwa-foe2t-default-rtdb.europe-west1.firebasedatabase.app',
  projectId: 'khatwa-foe2t',
  storageBucket: 'khatwa-foe2t.firebasestorage.app',
  messagingSenderId: '320925984448',
  appId: '1:320925984448:web:bbf63b11b2a2601101ef25',
};

export const DEFAULT_DEVICE_ID = 'khatwa-01';
