// Contact sheet: every framed screen, 6 per A4 page, Arabic name under each → deliverables/khatwa-all-screens.pdf
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium } = require('@playwright/test');

const RAW = new URL('./allshots-raw/', import.meta.url).pathname;
const FRAMED = new URL('../../deliverables/all-screens/', import.meta.url).pathname;
const OUT = new URL('../../deliverables/khatwa-all-screens.pdf', import.meta.url).pathname;
const TMP = new URL('./tmp-sheet/', import.meta.url).pathname;
const F = new URL('../../web/node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-arabic', import.meta.url).pathname;
mkdirSync(TMP, { recursive: true });
const font = (w) => `data:font/woff2;base64,${readFileSync(`${F}-${w}-normal.woff2`).toString('base64')}`;

const items = JSON.parse(readFileSync(`${RAW}manifest.json`, 'utf8'));
const cards = items.map((it, i) => {
  const small = `${TMP}${it.file}`;
  execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-i', FRAMED + it.file, '-vf', 'scale=560:-1', small]);
  const img = `data:image/png;base64,${readFileSync(small).toString('base64')}`;
  return `<figure><img src="${img}"><figcaption><b>${String(i + 1).padStart(2, '0')}</b> ${it.ar}<span>${it.file}</span></figcaption></figure>`;
});
const pages = [];
for (let i = 0; i < cards.length; i += 6) pages.push(`<section>${cards.slice(i, i + 6).join('')}</section>`);

const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>
@font-face{font-family:Plex;font-weight:500;src:url(${font(500)})}
@font-face{font-family:Plex;font-weight:700;src:url(${font(700)})}
@page{size:A4;margin:12mm 10mm}
*{margin:0;box-sizing:border-box}
body{font-family:Plex,sans-serif;color:#10201f}
header{display:flex;justify-content:space-between;align-items:baseline;margin-bottom:4mm;border-bottom:2px solid #0F4C5C;padding-bottom:2mm}
header h1{font-size:15pt;color:#0F4C5C}
header p{font-size:8.5pt;color:#4f605c}
section{display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr);gap:4mm 5mm;height:255mm;break-after:page}
section:last-child{break-after:auto}
figure{display:flex;flex-direction:column;align-items:center;justify-content:flex-start;min-height:0}
img{height:108mm;width:auto}
figcaption{margin-top:1.5mm;text-align:center;font-size:9.5pt;font-weight:500;line-height:1.35}
figcaption b{color:#0F4C5C;font-weight:700}
figcaption span{display:block;font-size:7pt;color:#7a8a86;direction:ltr}
</style></head><body>
<header><h1>خطوة: كل الشاشات بالترتيب</h1><p>نسخة عرض · بيانات محاكاة · الجهاز المادي يُبنى للنهائيات · ${items.length} شاشة</p></header>
${pages.join('')}
</body></html>`;

const b = await chromium.launch();
const p = await b.newPage();
await p.setContent(html, { waitUntil: 'load' });
await p.evaluate(() => document.fonts.ready);
await p.pdf({ path: OUT, format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' } });
await b.close();
console.log('wrote', OUT);
