// Six clean phone screenshots for the deck: 1290x2796 (430x932 CSS px at 3x), no browser or preview chrome.
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium } = require('@playwright/test');

const APP = 'https://deploy-preview-1--dulcet-blini-8f718e.netlify.app';
const OUT = new URL('../../deliverables/screens/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: 430, height: 932 },
  deviceScaleFactor: 3,
  isMobile: true,
  hasTouch: true,
  locale: 'ar-SA',
  timezoneId: 'Asia/Riyadh',
});
await ctx.addInitScript(() => {
  const add = () => {
    const st = document.createElement('style');
    st.textContent = '[data-netlify-deploy-id]{display:none!important}';
    (document.head || document.documentElement).appendChild(st);
  };
  if (document.documentElement) add();
  else document.addEventListener('DOMContentLoaded', add);
});
const p = await ctx.newPage();
const shot = async (name) => {
  await p.evaluate(() => document.fonts.ready);
  await sleep(700);
  await p.screenshot({ path: `${OUT}${name}.png` });
  console.log('saved', name);
};

// First visit: simulation with the 30-day "developing" history (as a judge would see it).
await p.goto(`${APP}/home?as=patient&nosplash=1`);
await p.getByTestId('today-hero').waitFor();
await p.evaluate(() => {
  const s = JSON.parse(localStorage.getItem('kh.settings'));
  Object.assign(s.state, { patientName: 'أبو سعد', familyName: 'سعد', patientPhone: '0551234567' });
  localStorage.setItem('kh.settings', JSON.stringify(s));
});
await p.goto(`${APP}/home?nosplash=1`);
await p.getByTestId('today-hero').waitFor();
await shot('1-patient-home');

await p.goto(`${APP}/result?nosplash=1`);
await p.getByTestId('result-hero').waitFor();
await shot('2-scan-result-orange');

await p.goto(`${APP}/family?as=family&nosplash=1`);
await p.getByTestId('family-wa').waitFor();
await shot('3-family');

await p.goto(`${APP}/assistant?as=patient&nosplash=1`);
await p.getByRole('textbox').fill('رجلي متورمة وفيها شي ينز');
await p.getByRole('button', { name: 'أرسل' }).click();
await sleep(5000);
await p.getByTestId('chat').locator('li').last().scrollIntoViewIfNeeded();
await shot('4-rafiq');

await p.goto(`${APP}/clinic?as=clinic&nosplash=1`);
await p.getByTestId('patient-real').waitFor();
await shot('5-clinic-list');

await p.goto(`${APP}/clinic/patient/real/report?nosplash=1`);
await p.getByTestId('report-qr').waitFor();
await shot('6-report');
await b.close();
