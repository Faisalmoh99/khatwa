// App-only clips for the deck: each flow is ONE continuous take at real speed (no cuts), on the simulation
// source, with a tap indicator. Output: raw frames + marks per clip, framed by compose_clips.py.
// Usage: node tools/video/clips.mjs [a|b|c|d|e|f|all]
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium } = require('@playwright/test');

const APP = process.env.APP_URL_FULL ?? 'https://deploy-preview-1--dulcet-blini-8f718e.netlify.app';
const OUT = new URL('./clips-raw/', import.meta.url).pathname;
const only = process.argv[2] ?? 'all';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Netlify's preview toolbar is not part of the app; a tap ring shows where each tap lands.
function pageSetup() {
  const add = () => {
    const st = document.createElement('style');
    st.textContent = `[data-netlify-deploy-id]{display:none!important}
      .kh-tap{position:fixed;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;pointer-events:none;z-index:2147483646;
        background:rgba(15,76,92,.28);border:2px solid rgba(15,76,92,.75);animation:kh-tap .55s ease-out forwards}
      @keyframes kh-tap{from{transform:scale(.55);opacity:1}to{transform:scale(1.25);opacity:0}}`;
    (document.head || document.documentElement).appendChild(st);
    addEventListener(
      'pointerdown',
      (e) => {
        const d = document.createElement('div');
        d.className = 'kh-tap';
        d.style.left = `${e.clientX}px`;
        d.style.top = `${e.clientY}px`;
        document.body.appendChild(d);
        setTimeout(() => d.remove(), 700);
      },
      true,
    );
  };
  if (document.documentElement) add();
  else document.addEventListener('DOMContentLoaded', add);
}

async function newPhone(browser) {
  const ctx = await browser.newContext({
    viewport: { width: 430, height: 932 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: false,
    locale: 'ar-SA',
    timezoneId: 'Asia/Riyadh',
  });
  await ctx.addInitScript(pageSetup);
  ctx.on('page', (p) => {
    // WhatsApp opens in a new tab (wa.me): close it, the recorded app tab stays.
    if (ctx.pages().length > 1) void p.close();
  });
  return { ctx, p: await ctx.newPage() };
}

async function record(page, name) {
  const dir = `${OUT}${name}`;
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  let n = 0;
  cdp.on('Page.screencastFrame', async (f) => {
    const file = `${dir}/${String(n++).padStart(6, '0')}.jpg`;
    writeFileSync(file, Buffer.from(f.data, 'base64'));
    frames.push({ file, t: f.metadata.timestamp });
    await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame: 1 });
  const start = Date.now() / 1000;
  return async () => {
    const end = Date.now() / 1000;
    await cdp.send('Page.stopScreencast').catch(() => {});
    writeFileSync(`${dir}/frames.json`, JSON.stringify(frames));
    writeFileSync(`${dir}/marks.json`, JSON.stringify({ start, end }));
    console.log(`[clip] ${name}: ${(end - start).toFixed(1)} s, ${frames.length} frames`);
  };
}

/** Human-paced tap on a locator (scrolls it into view smoothly first if needed). */
async function tap(p, loc, pause = 500) {
  await smoothInto(p, loc);
  const b = await loc.boundingBox();
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 });
  await sleep(180);
  await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await sleep(pause);
}
async function smoothInto(p, loc) {
  for (let i = 0; i < 30; i++) {
    const b = await loc.boundingBox();
    if (!b) return;
    const vh = 932 - 90; // keep clear of the bottom navigation
    if (b.y >= 120 && b.y + b.height <= vh) return;
    await p.mouse.move(215, 500);
    await p.mouse.wheel(0, b.y < 120 ? -110 : 110);
    await sleep(30);
  }
}
async function smoothScroll(p, px) {
  await p.mouse.move(215, 500);
  for (let i = 0; i < Math.abs(px) / 60; i++) await (p.mouse.wheel(0, Math.sign(px) * 60), sleep(35));
}
// From the result screen to a new scan, as a patient would: back to home, then «الفحص» in the bottom nav.
const toScan = async (p, pause = 900) => {
  await tap(p, p.getByRole('link', { name: 'الرئيسية' }).first(), pause);
  await tap(p, p.getByRole('link', { name: 'الفحص' }).last(), pause);
};
const hotStand = async (p) => {
  await p.getByTestId('sim-scenario').selectOption('hot');
  await tap(p, p.getByTestId('sim-start'), 200);
};
const until = (loc, ms = 30_000) => loc.waitFor({ timeout: ms });
const setNames = (p) =>
  p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('kh.settings'));
    Object.assign(s.state, { patientName: 'أبو سعد', familyName: 'سعد', patientPhone: '0551234567' });
    localStorage.setItem('kh.settings', JSON.stringify(s));
  });
// Unrecorded setup: hot stands so the next one is day `n + 1` (demo mode: each scan = one day).
async function setupDays(p, n, tick) {
  await p.goto(`${APP}/scan?source=sim&as=patient&demo=1&nosplash=1&simTick=60`);
  await setNames(p);
  for (let d = 0; d < n; d++) {
    await p.goto(`${APP}/scan?nosplash=1&simTick=60`);
    await p.getByTestId('sim-scenario').selectOption('hot');
    await p.getByTestId('sim-start').click();
    await p.waitForURL(/\/result/, { timeout: 60_000 });
  }
  await p.goto(`${APP}/${n ? 'result' : 'scan'}?nosplash=1&simTick=${tick}`);
  await sleep(1500);
}
// In-app role switch: settings → «غيّر الدور» → role screen.
async function switchRole(p, role) {
  await tap(p, p.getByRole('link', { name: 'الإعدادات' }).first(), 500);
  await tap(p, p.getByTestId('change-role'), 500);
  await tap(p, p.getByTestId(`role-${role}`), 700);
}

const flows = {
  // a) Scan: stand, live reading, result.
  async a(browser) {
    const { ctx, p } = await newPhone(browser);
    await setupDays(p, 0, 200);
    const stop = await record(p, 'a-scan');
    await sleep(1200);
    await hotStand(p);
    await until(p.getByTestId('scan-done'), 40_000);
    await p.waitForURL(/\/result/);
    await sleep(2800);
    await stop();
    await ctx.close();
  },
  // b) Day 1 yellow, then day 2 orange with the reason.
  async b(browser) {
    const { ctx, p } = await newPhone(browser);
    await setupDays(p, 1, 110);
    await p.goto(`${APP}/home?nosplash=1&simTick=110`); // day 1: yellow on the home screen
    await p.getByTestId('today-hero').waitFor();
    await sleep(1500);
    const stop = await record(p, 'b-days');
    await sleep(1900);
    await tap(p, p.getByRole('link', { name: 'الفحص' }).last(), 700);
    await hotStand(p);
    await until(p.getByTestId('scan-done'), 40_000);
    await p.waitForURL(/\/result/);
    await sleep(2500);
    await stop();
    await ctx.close();
  },
  // c) Family: the WhatsApp message button, then the family screen.
  async c(browser) {
    const { ctx, p } = await newPhone(browser);
    await setupDays(p, 2, 160);
    const stop = await record(p, 'c-family');
    await sleep(600);
    await tap(p, p.getByTestId('wa-family'), 700);
    await smoothScroll(p, -1200);
    await switchRole(p, 'family');
    await until(p.getByTestId('family-wa'));
    await sleep(1100);
    await smoothScroll(p, 240);
    await sleep(1100);
    await stop();
    await ctx.close();
  },
  // d) Rafiq: typing the message, then the red reply held 3+ seconds.
  async d(browser) {
    const { ctx, p } = await newPhone(browser);
    await setupDays(p, 2, 160);
    await p.goto(`${APP}/assistant?nosplash=1`);
    await sleep(1500);
    const stop = await record(p, 'd-rafiq');
    await sleep(500);
    await tap(p, p.getByRole('textbox'), 200);
    await p.keyboard.type('رجلي متورمة وفيها شي ينز', { delay: 75 });
    await sleep(300);
    await tap(p, p.getByRole('button', { name: 'أرسل' }), 100);
    await until(p.getByTestId('chat').locator('li').last().filter({ hasText: 'العيادة' }), 20_000);
    await sleep(1000); // smooth scroll settles above the input bar
    await sleep(3200); // red reply held, fully visible
    await stop();
    await ctx.close();
  },
  // e) Clinic: patient list, then the report with QR.
  async e(browser) {
    const { ctx, p } = await newPhone(browser);
    await setupDays(p, 2, 160);
    await p.goto(`${APP}/assistant?nosplash=1`);
    await p.getByRole('textbox').fill('رجلي متورمة وفيها شي ينز');
    await p.getByRole('button', { name: 'أرسل' }).click();
    await sleep(4000);
    await p.goto(`${APP}/clinic?as=clinic&nosplash=1`);
    await until(p.getByTestId('patient-real'));
    await sleep(1500);
    const stop = await record(p, 'e-clinic');
    await sleep(2200);
    await tap(p, p.getByTestId('patient-real'), 1600);
    await tap(p, p.getByRole('link', { name: 'تقرير الزيارة' }), 700);
    await until(p.getByTestId('report-qr'));
    await sleep(3200);
    await stop();
    await ctx.close();
  },
  // f) Full walkthrough: each flow is one continuous take at real speed; the role changes between them happen
  //    off camera and compose_clips.py joins the takes with short crossfades (no settings screens on screen).
  async f(browser) {
    const { ctx, p } = await newPhone(browser);
    await setupDays(p, 0, 80);
    await p.goto(`${APP}/home?nosplash=1&simTick=80`);
    await p.getByTestId('today-hero').waitFor();
    await sleep(1200);
    // 1) day 1 scan → yellow
    let stop = await record(p, 'f-1-scan');
    await sleep(2200); // home before the first scan
    await tap(p, p.getByTestId('start-scan'), 500);
    await hotStand(p);
    await until(p.getByTestId('scan-done'), 40_000);
    await p.waitForURL(/\/result/);
    await sleep(3200); // day 1: yellow
    await stop();
    // 2) day 2 scan → orange with the reason, then the WhatsApp message for the family
    await p.goto(`${APP}/scan?nosplash=1&simTick=80`);
    await sleep(1200);
    stop = await record(p, 'f-2-day2');
    await sleep(600);
    await hotStand(p);
    await until(p.getByTestId('scan-done'), 40_000);
    await p.waitForURL(/\/result/);
    await sleep(3600); // day 2: orange, the reason under it
    await tap(p, p.getByTestId('wa-family'), 1800);
    await stop();
    // 3) family screen
    await p.goto(`${APP}/family?as=family&nosplash=1`);
    await p.getByTestId('family-wa').waitFor();
    await sleep(1000);
    stop = await record(p, 'f-3-family');
    await sleep(2600);
    await smoothScroll(p, 300);
    await sleep(2800); // the alert the family received
    await stop();
    // 4) Rafiq: typing, then the red reply held
    await p.goto(`${APP}/assistant?as=patient&nosplash=1`);
    await p.getByRole('textbox').waitFor();
    await sleep(1200);
    stop = await record(p, 'f-4-rafiq');
    await sleep(500);
    await tap(p, p.getByRole('textbox'), 200);
    await p.keyboard.type('رجلي متورمة وفيها شي ينز', { delay: 75 });
    await sleep(300);
    await tap(p, p.getByRole('button', { name: 'أرسل' }), 100);
    await until(p.getByTestId('chat').locator('li').last().filter({ hasText: 'العيادة' }), 20_000);
    await sleep(1000);
    await sleep(3200);
    await stop();
    // 5) clinic: list, patient, report with QR
    await p.goto(`${APP}/clinic?as=clinic&nosplash=1`);
    await p.getByTestId('patient-real').waitFor();
    await sleep(1200);
    stop = await record(p, 'f-5-clinic');
    await sleep(3000); // red first, then orange
    await tap(p, p.getByTestId('patient-real'), 2200);
    await tap(p, p.getByRole('link', { name: 'تقرير الزيارة' }), 700);
    await until(p.getByTestId('report-qr'));
    await sleep(3800);
    await stop();
    await ctx.close();
  },
};

const browser = await chromium.launch();
try {
  for (const k of Object.keys(flows)) if (only === 'all' || only === k) await flows[k](browser);
} finally {
  await browser.close();
}
