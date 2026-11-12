// Renders the title cards (1080x1920) and caption bands (1080x320) as PNGs in IBM Plex Sans Arabic.
import { createRequire } from 'node:module';
import { mkdirSync, readFileSync } from 'node:fs';
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium } = require('@playwright/test');

const F = new URL('../../web/node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic', import.meta.url).pathname;
const LOGO = new URL('../../web/public/logo.png', import.meta.url).pathname;
const APP_URL = process.env.APP_URL ?? 'khatwa-medathon.netlify.app';
const OUT = new URL('./cards/', import.meta.url).pathname;
const data = (file, type) => `data:${type};base64,${readFileSync(file).toString('base64')}`;
const font = (w) => data(`${F}-${w}-normal.woff2`, 'font/woff2');
const logo = data(LOGO, 'image/png');
mkdirSync(OUT, { recursive: true });

const css = `
@font-face{font-family:Plex;font-weight:500;src:url(${font(500)})}
@font-face{font-family:Plex;font-weight:600;src:url(${font(600)})}
@font-face{font-family:Plex;font-weight:700;src:url(${font(700)})}
*{margin:0;box-sizing:border-box}
body{font-family:Plex,sans-serif;direction:rtl;color:#fff;background:#0a3742;-webkit-font-smoothing:antialiased}
.card{width:1080px;height:1920px;display:flex;flex-direction:column;justify-content:center;gap:56px;padding:0 96px;
  background:radial-gradient(120% 80% at 50% 30%,#145e70 0%,#0a3742 55%,#062a33 100%)}
.card img{width:150px;height:150px;border-radius:28px}
.big{font-size:92px;font-weight:700;line-height:1.35}
.mid{font-size:56px;font-weight:600;line-height:1.5}
.src{font-size:38px;font-weight:500;color:#cfe6ea;direction:ltr;text-align:right;border-top:3px solid #7fb6c0;padding-top:28px}
.link{font-size:31px;font-weight:600;direction:ltr;text-align:center;color:#fff;background:#145e70;padding:22px 20px;border-radius:18px;white-space:nowrap}
.small{font-size:34px;font-weight:500;color:#cfe6ea;line-height:1.5}
.band{width:1080px;height:320px;display:flex;flex-direction:column;justify-content:center;gap:18px;padding:0 56px;background:#0a3742}
.band .t{font-size:54px;font-weight:700;line-height:1.35}
.band .n{font-size:32px;font-weight:500;color:#b7d9de}
.tag{display:inline-block;font-size:34px;font-weight:700;background:#f2c230;color:#3b2c00;padding:8px 22px;border-radius:999px}
`;

const cards = {
  card1: `<div class="card"><img src="${logo}">
    <div class="big">كل 30 ثانية يفقد شخص في العالم ساقه بسبب السكري</div>
    <div class="src">The Lancet, 2005 (Boulton et al.)</div></div>`,
  card7: `<div class="card"><img src="${logo}">
    <div class="mid">مبني ومجرّب: التطبيق + رفيق + كود السجادة على محاكاة.<br>التجميع للنهائيات.</div>
    <div class="small">أداة مراقبة تدعم الإحالة، مو تشخيص.</div>
    <div class="link">${APP_URL}</div></div>`,
};
const bands = {
  s2: ['كود السجادة الحقيقي يشتغل على دائرة افتراضية', 'Wokwi: نفس كود ESP32 · 8 حساسات DS18B20 · الضغط تحت الكعب = مقاومة متغيرة'],
  s3: ['قاعدة IWGDF: فرق أكبر من 2.2° في نفس النقطة يومين ورا بعض', 'قراءتين من السجادة الافتراضية · وضع العرض: كل فحص = يوم'],
  s4: ['تنبيه العائلة: رسالة واتساب جاهزة، وشاشة خاصة بالعائلة', 'بيانات محاكاة'],
  s5: ['الذكاء الاصطناعي يفهم الكلام، والقاعدة الطبية هي اللي تقرر', 'رفيق · بيانات محاكاة'],
  s6: ['العيادة: المرضى بالأولوية، وتقرير الزيارة مع QR', 'بيانات محاكاة · بقية المرضى افتراضيون'],
};

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1920 } });
const shot = async (name, html, w, h) => {
  await p.setViewportSize({ width: w, height: h });
  await p.setContent(`<!doctype html><html lang="ar"><head><meta charset="utf-8"><style>${css}</style></head><body>${html}</body></html>`);
  await p.evaluate(() => document.fonts.ready);
  const ok = await p.evaluate(() => [...document.fonts].some((f) => f.family.replace(/"/g, '') === 'Plex' && f.status === 'loaded'));
  if (!ok) console.log(await p.evaluate(() => [...document.fonts].map((f) => f.family + ' ' + f.weight + ' ' + f.status)));
  if (!ok) throw new Error('IBM Plex Sans Arabic not loaded');
  await p.waitForTimeout(150);
  await p.screenshot({ path: `${OUT}${name}.png` });
};
for (const [k, html] of Object.entries(cards)) await shot(k, html, 1080, 1920);
for (const [k, [t, n]] of Object.entries(bands))
  await shot(`band-${k}`, `<div class="band"><div class="t">${t}</div><div class="n">${n}</div></div>`, 1080, 320);
await shot('tag-fast', `<div style="background:transparent;padding:8px"><span class="tag">مسرّع</span></div>`, 200, 80);
await b.close();
console.log('cards done');
