// Video assets for the iPhone-style frame on teal: overlay (app area transparent), app-area mask, background.
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
import { PHONE, phoneHtml } from './iphone.mjs';
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium } = require('@playwright/test');

const OUT = new URL('./frame-flow/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const W = 1080, H = 1920, K = 1.8, B = 13 * K;
const phoneW = (PHONE.w + 26) * K, phoneH = (PHONE.h + 26) * K;
const left = Math.round((W - phoneW) / 2), top = Math.round((H - phoneH) / 2);
// App area inside the frame (below the status bar), even sizes for H.264.
const geo = {
  x: Math.round(left + B), y: Math.round(top + B + PHONE.status * K),
  w: Math.round(PHONE.w * K / 2) * 2, h: Math.round(PHONE.appH * K / 2) * 2,
};
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: W, height: H } });
const page = (body, bg = 'transparent') =>
  `<!doctype html><html><head><style>*{margin:0}html,body{background:${bg}}</style></head><body>${body}</body></html>`;
await p.setContent(page(`<div style="position:absolute;left:${left}px;top:${top}px">${phoneHtml({ k: K, statusBg: '#0a3742', pad: 0, hollow: true })}</div>`));
await p.screenshot({ path: `${OUT}overlay.png`, omitBackground: true });
await p.setViewportSize({ width: geo.w, height: geo.h });
await p.setContent(page(`<div style="position:absolute;left:0;top:${-PHONE.status * K}px;width:${geo.w}px;height:${PHONE.h * K}px;border-radius:${55 * K}px;background:#fff"></div>`, '#000'));
await p.screenshot({ path: `${OUT}mask.png` });
await p.setViewportSize({ width: W, height: H });
await p.setContent(page('', '#0F4C5C'));
await p.screenshot({ path: `${OUT}bg.png` });
await b.close();
writeFileSync(`${OUT}geo.json`, JSON.stringify(geo));
console.log('geo', geo);
