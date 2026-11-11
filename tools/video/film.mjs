// Films real footage for the demo video: Wokwi (real firmware) + the app on the preview link.
// Every page is recorded as a CDP screencast (JPEG frames with wall-clock timestamps). Markers go to marks.json.
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium } = require('@playwright/test');

const APP = 'https://deploy-preview-1--dulcet-blini-8f718e.netlify.app';
const WOKWI = 'https://wokwi.com/projects/480390288294528001';
const OUT = new URL('./raw/', import.meta.url).pathname;
const only = process.argv[2] ?? 'all'; // 'wokwi' | 'sim' | 'all'
const marks = {};
const mark = (k) => ((marks[k] = Date.now() / 1000), console.log(`[mark] ${k}`));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function record(page, name, everyNthFrame = 1) {
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
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 92, everyNthFrame });
  return async () => {
    await cdp.send('Page.stopScreencast').catch(() => {});
    writeFileSync(`${dir}/frames.json`, JSON.stringify(frames));
    console.log(`[rec] ${name}: ${frames.length} frames`);
  };
}

const browser = await chromium.launch();
// Netlify injects a "Collaborate / Log in" toolbar into deploy previews only: not part of the app, hidden in the footage.
const hideNetlify = () => {
  const add = () => {
    const st = document.createElement('style');
    st.textContent = '[data-netlify-deploy-id]{display:none!important}';
    (document.head || document.documentElement).appendChild(st);
  };
  if (document.documentElement) add();
  else document.addEventListener('DOMContentLoaded', add);
};

async function filmWokwi() {
  const wctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
  const w = await wctx.newPage();
  const actx = await browser.newContext({
    viewport: { width: 432, height: 351 },
    deviceScaleFactor: 2.5,
    locale: 'ar-SA',
    timezoneId: 'Asia/Riyadh',
  });
  await actx.addInitScript(hideNetlify);
  const app = await actx.newPage();

  // App: Wokwi source, demo mode switched on now (each scan = one day from here).
  await app.setViewportSize({ width: 432, height: 640 });
  await app.goto(`${APP}/settings?source=wokwi&as=patient&nosplash=1`);
  await app.getByText('متصل بالسجادة الافتراضية (Wokwi)').first().waitFor();
  const demo = app.getByRole('switch', { name: /كل فحص = يوم/ });
  if ((await demo.getAttribute('aria-checked')) !== 'true') await demo.click();
  await app.setViewportSize({ width: 432, height: 351 });
  await app.goto(`${APP}/scan?nosplash=1`);
  await app.getByText('متصل بالسجادة الافتراضية (Wokwi)').first().waitFor();

  // Wokwi: compile + boot + sign-in (not filmed).
  await w.goto(WOKWI);
  await w.getByRole('button', { name: 'Start the simulation' }).click();
  await w.waitForFunction(() => document.body.innerText.includes('# auth: ready'), null, { timeout: 300_000 });
  console.log('wokwi ready');
  // Start only once the app shows the virtual mat as connected (heartbeat seen within 60 s).
  const connected = () =>
    app
      .getByTestId('scan-offline')
      .waitFor({ state: 'hidden', timeout: 120_000 })
      .catch(() => console.log('!! app still shows the mat offline'));
  await connected();
  await sleep(2000);
  const stopW = await record(w, 'wokwi', 3);
  const stopA = await record(app, 'app-wokwi');
  await sleep(2500);
  const pots = async (key) => {
    const centers = await w.evaluate(() =>
      [...document.querySelectorAll('wokwi-potentiometer')].map((e) => {
        const r = e.getBoundingClientRect();
        return [r.x + r.width / 2, r.y + r.height / 2];
      }),
    );
    for (const [x, y] of centers) {
      await w.mouse.click(x, y);
      await sleep(300);
      await w.keyboard.press(key);
      await sleep(600);
    }
  };
  // Zoom the Wokwi canvas in/out around the heated sensor (R MTH1), and enlarge its temperature popup.
  const ZOOM_AT = [1268, 420];
  const zoom = async (dir) => {
    await w.mouse.move(...ZOOM_AT);
    for (let i = 0; i < 8; i++) await (w.mouse.wheel(0, dir * 100), sleep(110));
    await sleep(500);
  };
  const bigPopup = () =>
    w.evaluate(() => {
      const r = document.querySelector('input[type=range]');
      let el = r;
      // the popup panel: the nearest ancestor that also holds the sensor title
      while (el && !el.textContent.includes('DS18B20')) el = el.parentElement;
      if (el) {
        el.style.zoom = '1.75';
        return true;
      }
      return false;
    });
  const setTemp = (val) =>
    w.evaluate((v) => {
      const r = document.querySelector('input[type=range]');
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(r, v.toFixed(1));
      r.dispatchEvent(new Event('input', { bubbles: true }));
      r.dispatchEvent(new Event('change', { bubbles: true }));
    }, val);
  const authCount = () => w.evaluate(() => document.body.innerText.split('# auth: ready').length - 1);
  // After a stall (the virtual ESP32's requests stop being answered), restart the simulation and wait for sign-in.
  const restart = async () => {
    console.log('!! stall: restarting the simulation');
    const before = await authCount();
    await w.getByRole('button', { name: /restart/i }).first().click();
    await w.waitForFunction(
      (n) => document.body.innerText.split('# auth: ready').length - 1 > n || document.body.innerText.split('# auth: ready').length - 1 === 1,
      before,
      { timeout: 300_000 },
    );
    await sleep(2000);
  };
  const scanShown = (ms) =>
    app
      .getByTestId('scan-done')
      .waitFor({ timeout: ms })
      .then(() => true)
      .catch(() => false);

  // Scene 2: right MTH1 +2.6 °C (30.7 → 33.3) with the sensor's own slider, then both heels down.
  for (let attempt = 1; ; attempt++) {
    if (attempt > 3) throw new Error('stand 1 failed 3 times');
    mark('s2_start');
    await zoom(-1);
    // R MTH1 after zooming around ZOOM_AT
    await w.mouse.click(1268, 397);
    await sleep(500);
    if (!(await w.locator('input[type=range]').count())) throw new Error('sensor popup did not open');
    console.log('popup enlarged:', await bigPopup());
    await sleep(1000);
    mark('s2_slider');
    for (let v = 30.7; v <= 33.31; v += 0.1) {
      await setTemp(v);
      await sleep(110);
    }
    await sleep(1500);
    await zoom(1);
    mark('s2_pots');
    await pots('End');
    mark('s2_standing');
    if (await scanShown(100_000)) break;
    await pots('Home');
    await restart();
    await app.goto(`${APP}/scan?nosplash=1`);
    await app.getByText('متصل بالسجادة الافتراضية (Wokwi)').first().waitFor();
    await sleep(1500);
  }
  mark('s2_scan_shown');
  await app.waitForURL(/\/result/, { timeout: 10_000 });
  await sleep(1500);
  mark('s2_result');
  await sleep(2500);

  // Scene 3: full-height app. Day 1 result (yellow), then a second stand = day 2.
  await app.setViewportSize({ width: 432, height: 640 });
  await sleep(1500);
  mark('s3_day1');
  await sleep(3500);
  await pots('Home');
  await sleep(8000); // step off: the mat goes back to idle
  for (let attempt = 1; ; attempt++) {
    if (attempt > 3) throw new Error('stand 2 failed 3 times');
    await app.goto(`${APP}/scan?nosplash=1`);
    await app.getByText('متصل بالسجادة الافتراضية (Wokwi)').first().waitFor();
    await connected();
    await sleep(1000);
    mark('s3_scan2');
    await pots('End');
    if (await scanShown(100_000)) break;
    await pots('Home');
    await restart();
    // a restart resets the sensor to 30.7: set R MTH1 again
    await w.mouse.click(1268, 403);
    await sleep(800);
    await setTemp(33.3);
    await sleep(800);
  }
  mark('s3_scan2_shown');
  await app.waitForURL(/\/result/, { timeout: 10_000 });
  await sleep(1200);
  mark('s3_orange');
  await sleep(2500);
  await app.mouse.move(216, 400);
  for (let i = 0; i < 6; i++) await (app.mouse.wheel(0, 40), sleep(120));
  await sleep(3000);
  mark('s3_end');
  await stopA();
  await stopW();
  writeFileSync(`${OUT}wokwi-serial.txt`, await w.evaluate(() => document.body.innerText));
  await wctx.close();
  await actx.close();
}

async function filmSim() {
  const ctx = await browser.newContext({
    viewport: { width: 432, height: 640 },
    deviceScaleFactor: 2.5,
    locale: 'ar-SA',
    timezoneId: 'Asia/Riyadh',
  });
  await ctx.addInitScript(hideNetlify);
  const p = await ctx.newPage();
  // Setup (not filmed): simulation, demo mode, two hot stands → day 2 orange.
  await p.goto(`${APP}/scan?source=sim&as=patient&demo=1&nosplash=1&simTick=60`);
  await p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('kh.settings'));
    Object.assign(s.state, { patientName: 'أبو سعد', familyName: 'سعد', patientPhone: '0551234567' });
    localStorage.setItem('kh.settings', JSON.stringify(s));
  });
  await p.goto(`${APP}/scan?nosplash=1&simTick=60`);
  for (let d = 0; d < 2; d++) {
    await p.goto(`${APP}/scan?nosplash=1&simTick=60`);
    await p.getByTestId('sim-scenario').selectOption('hot');
    await p.getByTestId('sim-start').click();
    await p.waitForURL(/\/result/, { timeout: 60_000 });
  }
  await p.goto(`${APP}/result?nosplash=1`);
  await p.getByTestId('wa-family').waitFor();
  const stop = await record(p, 'app-sim');
  await sleep(1000);

  // Scene 4: WhatsApp button for the family, then the family screen.
  mark('s4_start');
  await p.getByTestId('wa-family').scrollIntoViewIfNeeded();
  await sleep(600);
  await p.getByTestId('wa-family').hover();
  await sleep(2600);
  mark('s4_family');
  await p.goto(`${APP}/family?as=family&nosplash=1`);
  await p.getByTestId('family-wa').waitFor();
  await sleep(2500);
  await p.mouse.move(216, 400);
  for (let i = 0; i < 6; i++) await (p.mouse.wheel(0, 45), sleep(120));
  await sleep(3000);

  // Scene 5: Rafiq.
  mark('s5_start');
  await p.goto(`${APP}/assistant?as=patient&nosplash=1`);
  await p.getByRole('textbox').waitFor();
  await sleep(1500);
  await p.getByRole('textbox').click();
  await p.keyboard.type('رجلي متورمة وفيها شي ينز', { delay: 110 });
  await sleep(700);
  mark('s5_send');
  await p.getByRole('button', { name: 'أرسل' }).click();
  await p.getByTestId('chat').locator('li').last().filter({ hasText: 'العيادة' }).waitFor({ timeout: 20_000 });
  await sleep(1300); // smooth scroll settles above the input bar
  mark('s5_red');
  await sleep(4000); // red reply held, fully visible
  mark('s5_end');

  // Scene 6: clinic list, then the report with QR.
  mark('s6_start');
  await p.goto(`${APP}/clinic?as=clinic&nosplash=1`);
  await p.getByTestId('patient-real').waitFor();
  await sleep(4000);
  mark('s6_report');
  await p.goto(`${APP}/clinic/patient/real/report?nosplash=1`);
  await p.getByTestId('report-qr').waitFor();
  await sleep(2000);
  await p.mouse.move(216, 400);
  for (let i = 0; i < 10; i++) await (p.mouse.wheel(0, 50), sleep(150));
  await sleep(1500);
  await p.getByTestId('report-qr').scrollIntoViewIfNeeded();
  await sleep(4000);
  mark('s6_end');
  await stop();
  await ctx.close();
}

try {
  if (only === 'all' || only === 'wokwi') await filmWokwi();
  if (only === 'all' || only === 'sim') await filmSim();
} finally {
  const prev = (() => {
    try {
      return JSON.parse(require('node:fs').readFileSync(`${OUT}marks.json`, 'utf8'));
    } catch {
      return {};
    }
  })();
  mkdirSync(OUT, { recursive: true });
  writeFileSync(`${OUT}marks.json`, JSON.stringify({ ...prev, ...marks }, null, 1));
  await browser.close();
}
