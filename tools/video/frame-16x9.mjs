// Assets for the 16:9 demo (1920x1080): background, iPhone-style frame (centre / right), app mask, cards, captions.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PHONE, phoneHtml } from './iphone.mjs';
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium } = require('@playwright/test');

const OUT = new URL('./frame-16x9/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const W = 1920, H = 1080, K = 1.04, B = 13 * K;
const F = new URL('../../web/node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic', import.meta.url).pathname;
const font = (w) => `data:font/woff2;base64,${readFileSync(`${F}-${w}-normal.woff2`).toString('base64')}`;
const logo = `data:image/png;base64,${readFileSync(new URL('../../web/public/logo.png', import.meta.url)).toString('base64')}`;
const APP_URL = process.env.APP_URL ?? 'deploy-preview-1--dulcet-blini-8f718e.netlify.app';

const phoneW = (PHONE.w + 26) * K, phoneH = (PHONE.h + 26) * K;
const top = Math.round((H - phoneH) / 2);
const lefts = { center: Math.round((W - phoneW) / 2), right: Math.round(W - phoneW - 96) };
const app = (left) => ({
  x: Math.round(left + B), y: Math.round(top + B + PHONE.status * K),
  w: Math.round((PHONE.w * K) / 2) * 2, h: Math.round((PHONE.appH * K) / 2) * 2,
});
const geo = {
  phone: { w: Math.round(phoneW), h: Math.round(phoneH), top, ...lefts },
  center: app(lefts.center),
  right: app(lefts.right),
  // Wokwi panel (left, next to the phone on the right): 3:2 like the recorded crop
  wokwi: { x: 64, y: 70, w: 1200, h: 802 },
};

const css = `
@font-face{font-family:Plex;font-weight:500;src:url(${font(500)})}
@font-face{font-family:Plex;font-weight:700;src:url(${font(700)})}
*{margin:0;box-sizing:border-box}html,body{background:transparent}
body{font-family:Plex,sans-serif;direction:rtl;color:#fff;-webkit-font-smoothing:antialiased}
.cap{font-weight:700;line-height:1.4;text-shadow:0 2px 10px rgba(0,0,0,.25)}`;
const page = (body, bg = 'transparent') =>
  `<!doctype html><html lang="ar"><head><meta charset="utf-8"><style>${css} html,body{background:${bg}}</style></head><body>${body}</body></html>`;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: W, height: H } });
const shot = async (file, html, w = W, h = H, transparent = true) => {
  await p.setViewportSize({ width: w, height: h });
  await p.setContent(html);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(80);
  await p.screenshot({ path: OUT + file, omitBackground: transparent });
};

await shot('bg.png', page('', '#0F4C5C'), W, H, false);
for (const pos of ['center', 'right'])
  await shot(
    `overlay-${pos}.png`,
    page(`<div style="position:absolute;left:${lefts[pos]}px;top:${top}px">${phoneHtml({ k: K, statusBg: '#0a3742', hollow: true })}</div>`),
  );
const a = geo.center;
await shot(
  'mask.png',
  page(`<div style="position:absolute;left:0;top:${-PHONE.status * K}px;width:${a.w}px;height:${PHONE.h * K}px;border-radius:${55 * K}px;background:#fff"></div>`, '#000'),
  a.w, a.h, false,
);
// Wokwi panel: rounded card edge so the circuit sits on the teal background cleanly.
await shot(
  'wokwi-mask.png',
  page(`<div style="position:absolute;inset:0;border-radius:22px;background:#fff"></div>`, '#000'),
  geo.wokwi.w, geo.wokwi.h, false,
);

// Captions: one line per scene. s2 sits under the Wokwi panel; the others beside the centred phone (right side).
const CAPS = {
  s2: 'كود السجادة الحقيقي يشتغل على دائرة افتراضية',
  s3: 'قاعدة IWGDF: فرق أكبر من 2.2° في نفس النقطة يومين ورا بعض',
  s4: 'تنبيه العائلة: رسالة واتساب جاهزة، وشاشة خاصة بالعائلة',
  s5: 'الذكاء الاصطناعي يفهم الكلام، والقاعدة الطبية هي اللي تقرر',
  s6: 'العيادة: الأحمر أولًا، وتقرير الزيارة مع QR',
};
const sideX = lefts.center + Math.round(phoneW) + 64;
geo.side = { x: sideX, w: W - sideX - 72 };
geo.under = { x: geo.wokwi.x, y: geo.wokwi.y + geo.wokwi.h + 34, w: geo.wokwi.w };
await shot('cap-s2.png', page(`<div class="cap" style="font-size:50px;width:${geo.under.w}px">${CAPS.s2}</div>`), geo.under.w, 120);
for (const k of ['s3', 's4', 's5', 's6'])
  await shot(
    `cap-${k}.png`,
    page(`<div style="height:100vh;display:flex;align-items:center"><div class="cap" style="font-size:54px;width:${geo.side.w}px">${CAPS[k]}</div></div>`),
    geo.side.w, 700,
  );

// Cards (16:9)
const card = (inner) =>
  page(
    `<div style="width:${W}px;height:${H}px;display:flex;align-items:center;gap:90px;padding:0 150px;
      background:radial-gradient(120% 110% at 70% 40%,#145e70 0%,#0a3742 55%,#062a33 100%)">
      <img src="${logo}" style="width:220px;height:220px;border-radius:40px;flex:none">
      <div style="display:grid;gap:40px">${inner}</div></div>`,
  );
await shot(
  'card1.png',
  card(`<div style="font-size:84px;font-weight:700;line-height:1.35">كل 30 ثانية يفقد شخص في العالم ساقه بسبب السكري</div>
        <div style="font-size:38px;font-weight:500;color:#cfe6ea;direction:ltr;text-align:right;border-top:3px solid #7fb6c0;padding-top:24px">The Lancet, 2005 (Boulton et al.)</div>`),
  W, H, false,
);
await shot(
  'card7.png',
  card(`<div style="font-size:60px;font-weight:700;line-height:1.5">مبني ومجرّب: التطبيق + رفيق + كود السجادة على محاكاة.<br>التجميع للنهائيات.</div>
        <div style="font-size:36px;font-weight:500;color:#cfe6ea">أداة مراقبة تدعم الإحالة، مو تشخيص.</div>
        <div style="font-size:34px;font-weight:700;direction:ltr;text-align:right;background:#145e70;padding:20px 28px;border-radius:18px;width:fit-content">${APP_URL}</div>`),
  W, H, false,
);
await b.close();
writeFileSync(`${OUT}geo.json`, JSON.stringify(geo, null, 1));
console.log(JSON.stringify(geo));
