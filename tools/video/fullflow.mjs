// Full flow, splash → report with AI summary. Each flow is one continuous take at real speed (tap indicator);
// role changes happen off camera and compose_fullflow.py joins the takes with short crossfades.
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium } = require('@playwright/test');

const APP = process.env.APP_URL_FULL ?? 'https://deploy-preview-1--dulcet-blini-8f718e.netlify.app';
const OUT = new URL('./flow-raw/', import.meta.url).pathname;
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const VH = 873;

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

async function record(page, name) {
  const dir = `${OUT}${name}`;
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
  return async (startAt) => {
    const end = Date.now() / 1000;
    await cdp.send('Page.stopScreencast').catch(() => {});
    await cdp.detach().catch(() => {});
    writeFileSync(`${dir}/frames.json`, JSON.stringify(frames));
    writeFileSync(`${dir}/marks.json`, JSON.stringify({ start: startAt ?? start, end }));
    console.log(`[take] ${name}: ${(end - start).toFixed(1)} s, ${frames.length} frames`);
  };
}

async function smoothInto(p, loc) {
  for (let i = 0; i < 40; i++) {
    const b = await loc.boundingBox();
    if (!b) return;
    if (b.y >= 120 && b.y + b.height <= VH - 90) return;
    await p.mouse.move(215, 450);
    await p.mouse.wheel(0, b.y < 120 ? -110 : 110);
    await sleep(30);
  }
}
async function tap(p, loc, pause = 500) {
  await smoothInto(p, loc);
  const b = await loc.boundingBox();
  await p.mouse.move(b.x + b.width / 2, b.y + b.height / 2, { steps: 6 });
  await sleep(160);
  await p.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await sleep(pause);
}
const until = (loc, ms = 30_000) => loc.waitFor({ timeout: ms });
const hotStand = async (p) => {
  await p.getByTestId('sim-scenario').selectOption('hot');
  await tap(p, p.getByTestId('sim-start'), 200);
};

const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({
    viewport: { width: 430, height: VH },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: false,
    locale: 'ar-SA',
    timezoneId: 'Asia/Riyadh',
  });
  await ctx.addInitScript(pageSetup);
  ctx.on('page', (pg) => ctx.pages().length > 1 && void pg.close());
  const p = await ctx.newPage();

  // 1) Splash → onboarding → consent → login → code → role → patient home (one take).
  let stop = await record(p, '1-intro');
  await p.goto(`${APP}/?source=sim&demo=1&simTick=110`);
  await p.getByTestId('splash').waitFor({ timeout: 10_000 });
  const splashAt = Date.now() / 1000 - 0.1; // the take starts on the splash, not on the blank page loading
  await until(p.getByTestId('onb-next'), 10_000);
  await sleep(2200);
  await tap(p, p.getByTestId('onb-next'), 1900);
  await tap(p, p.getByTestId('onb-next'), 1900);
  await tap(p, p.getByTestId('onb-next'), 900);
  await until(p.getByTestId('consent-accept'));
  await sleep(900);
  await tap(p, p.getByRole('switch', { name: /أوافق على جمع بيانات القياس/ }), 300);
  await tap(p, p.getByRole('switch', { name: /مشاركة التنبيهات مع العائلة/ }), 300);
  await tap(p, p.getByTestId('consent-accept'), 700);
  await tap(p, p.getByTestId('login-phone'), 200);
  await p.keyboard.type('0551234567', { delay: 85 });
  await tap(p, p.getByTestId('login-next'), 600);
  await tap(p, p.getByTestId('login-otp'), 200);
  await p.keyboard.type('1234', { delay: 160 });
  await tap(p, p.getByTestId('login-verify'), 900);
  await tap(p, p.getByTestId('role-patient'), 900);
  await until(p.getByTestId('start-scan'));
  await sleep(1800);
  await stop(splashAt);

  // 2) Scan → day 1 yellow. (The fast simulated clock is lost in the welcome redirect: reload off camera.)
  await p.goto(`${APP}/home?nosplash=1&simTick=110`);
  await until(p.getByTestId('start-scan'));
  await sleep(1000);
  stop = await record(p, '2-day1');
  await sleep(500);
  await tap(p, p.getByTestId('start-scan'), 600);
  await hotStand(p);
  await until(p.getByTestId('scan-done'), 40_000);
  await p.waitForURL(/\/result/);
  await sleep(2800);
  await stop();

  // 3) Day 2 → orange with the reason → the WhatsApp alert for the family.
  await p.goto(`${APP}/scan?nosplash=1&simTick=110`);
  await sleep(1200);
  stop = await record(p, '3-day2');
  await sleep(500);
  await hotStand(p);
  await until(p.getByTestId('scan-done'), 40_000);
  await p.waitForURL(/\/result/);
  await sleep(3200);
  await tap(p, p.getByTestId('wa-family'), 1600);
  await stop();

  // 4) The family's screen with the alert.
  await p.goto(`${APP}/family?as=family&nosplash=1`);
  await until(p.getByTestId('family-wa'));
  await sleep(1000);
  stop = await record(p, '4-family');
  await sleep(2500);
  await p.mouse.move(215, 450);
  for (let i = 0; i < 5; i++) await (p.mouse.wheel(0, 60), sleep(35));
  await sleep(2600);
  await stop();

  // 5) Rafiq: typing, then the red reply held.
  await p.goto(`${APP}/assistant?as=patient&nosplash=1`);
  await until(p.getByRole('textbox'));
  await sleep(1200);
  stop = await record(p, '5-rafiq');
  await sleep(600);
  await tap(p, p.getByRole('textbox'), 200);
  await p.keyboard.type('رجلي متورمة وفيها شي ينز', { delay: 80 });
  await sleep(300);
  await tap(p, p.getByRole('button', { name: 'أرسل' }), 100);
  await until(p.getByTestId('chat').locator('li').last().filter({ hasText: 'العيادة' }), 20_000);
  await sleep(4300);
  await stop();

  // 6) Clinic: list → patient → report → AI doctor summary.
  await p.goto(`${APP}/clinic?as=clinic&nosplash=1`);
  await until(p.getByTestId('patient-real'));
  await sleep(1200);
  stop = await record(p, '6-clinic');
  await sleep(2600);
  await tap(p, p.getByTestId('patient-real'), 2400);
  await tap(p, p.getByRole('link', { name: 'تقرير الزيارة' }), 1400);
  await tap(p, p.getByTestId('report-summary-btn'), 300);
  await until(p.getByTestId('report-summary-text'), 30_000);
  await sleep(600);
  await smoothInto(p, p.getByTestId('report-summary-text'));
  await sleep(4200);
  await stop();
  await ctx.close();
} finally {
  await browser.close();
}
