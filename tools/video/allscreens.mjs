// Captures EVERY app screen (real screenshots, preview link, simulation data) at 430x873 pt, 3x.
// Raw shots → tools/video/allshots-raw/, manifest with Arabic names → allshots-raw/manifest.json.
// Then: node tools/video/frame-all.mjs (iPhone-style frame) and node tools/video/sheet.mjs (PDF).
import { createRequire } from 'node:module';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
const require = createRequire(new URL('../../web/package.json', import.meta.url));
const { chromium } = require('@playwright/test');

const APP = process.env.APP_URL_FULL ?? 'https://deploy-preview-1--dulcet-blini-8f718e.netlify.app';
const OUT = new URL('./allshots-raw/', import.meta.url).pathname;
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Flow order and Arabic names (the numbers in the file names follow this list).
const ORDER = [
  ['splash', 'شاشة البداية'],
  ['onboarding-1', 'الترحيب 1: وش خطوة؟'],
  ['onboarding-2', 'الترحيب 2: كيف تقيس؟'],
  ['onboarding-3', 'الترحيب 3: مين يوصله التنبيه؟'],
  ['consent', 'الموافقة والخصوصية'],
  ['login-phone', 'الدخول: رقم الجوال'],
  ['login-otp', 'الدخول: رمز التحقق'],
  ['role', 'اختيار الدور'],
  ['patient-home', 'المريض: الرئيسية'],
  ['scan-standing', 'الفحص: الوقوف على السجادة'],
  ['scan-measuring', 'الفحص: القياس'],
  ['scan-done', 'الفحص: تم'],
  ['result-yellow', 'النتيجة: أصفر (اليوم الأول)'],
  ['result-orange', 'النتيجة: برتقالي (اليوم الثاني)'],
  ['quick-check', 'الفحص السريع'],
  ['history', 'السجل'],
  ['rafiq', 'رفيق: محادثة'],
  ['rafiq-red', 'رفيق: رد علامة الخطر'],
  ['photo', 'تصوير القدم'],
  ['tips', 'نصائح العناية'],
  ['more', 'المزيد'],
  ['settings', 'الإعدادات'],
  ['report', 'تقرير الزيارة مع ملخص الطبيب'],
  ['booking', 'حجز موعد (تجريبي)'],
  ['device', 'جهازي'],
  ['coming-soon', 'قادم قريبًا'],
  ...[
    'فحص اليوم',
    'اليوم الأول: أصفر',
    'اليوم الثاني',
    'اليوم الثاني: برتقالي',
    'تنبيه العائلة',
    'شاشة العائلة',
    'رفيق',
    'العيادة',
    'تقرير الزيارة',
  ].map((t, i) => [`tour-${i + 1}`, `جولة السيناريو ${i + 1}: ${t}`]),
  ['family-home', 'العائلة: الرئيسية مع التنبيه'],
  ['clinic-list', 'العيادة: قائمة المرضى'],
  ['clinic-patient', 'العيادة: تفاصيل المريض'],
  ['clinic-report', 'العيادة: تقرير الزيارة'],
  ['clinic-audit', 'العيادة: سجل التدقيق'],
  ['clinic-lab', 'العيادة: مختبر القاعدة'],
];
const taken = new Set();

function hideNetlify() {
  const add = () => {
    const st = document.createElement('style');
    st.textContent = '[data-netlify-deploy-id]{display:none!important}';
    (document.head || document.documentElement).appendChild(st);
  };
  if (document.documentElement) add();
  else document.addEventListener('DOMContentLoaded', add);
}

const browser = await chromium.launch();
async function phone() {
  const ctx = await browser.newContext({
    viewport: { width: 430, height: 873 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    locale: 'ar-SA',
    timezoneId: 'Asia/Riyadh',
  });
  await ctx.addInitScript(hideNetlify);
  ctx.on('page', (p) => ctx.pages().length > 1 && void p.close());
  return { ctx, p: await ctx.newPage() };
}
async function shot(p, name, { settle = 600, fonts = true } = {}) {
  if (!ORDER.some(([n]) => n === name)) throw new Error(`unknown screen ${name}`);
  if (fonts) await p.evaluate(() => document.fonts.ready);
  await sleep(settle);
  await p.screenshot({ path: `${OUT}${name}.png` });
  taken.add(name);
  console.log('shot', name);
}
const setNames = (p) =>
  p.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('kh.settings'));
    Object.assign(s.state, { patientName: 'أبو سعد', familyName: 'سعد', patientPhone: '0551234567' });
    localStorage.setItem('kh.settings', JSON.stringify(s));
  });

try {
  // ---------- Intro + patient + family + clinic (one visitor, two-day story) ----------
  {
    const { ctx, p } = await phone();
    await p.goto(`${APP}/`);
    await p.getByTestId('splash').waitFor();
    await shot(p, 'splash', { settle: 150, fonts: false });
    await p.getByTestId('splash').waitFor({ state: 'hidden', timeout: 6000 });
    await shot(p, 'onboarding-1');
    await p.getByTestId('onb-next').click();
    await shot(p, 'onboarding-2');
    await p.getByTestId('onb-next').click();
    await shot(p, 'onboarding-3');
    await p.getByTestId('onb-next').click();
    await p.waitForURL(/\/consent/);
    await p.getByRole('switch', { name: /أوافق على جمع بيانات القياس/ }).click();
    await p.getByRole('switch', { name: /مشاركة التنبيهات مع العائلة/ }).click();
    await shot(p, 'consent');
    await p.getByTestId('consent-accept').click();
    await p.waitForURL(/\/login/);
    await p.getByTestId('login-phone').fill('0551234567');
    await shot(p, 'login-phone');
    await p.getByTestId('login-next').click();
    await p.getByTestId('login-otp').fill('1234');
    await shot(p, 'login-otp');
    await p.getByTestId('login-verify').click();
    await p.waitForURL(/\/role/);
    await shot(p, 'role');
    await p.getByTestId('role-patient').click();
    await p.getByTestId('today-hero').waitFor();
    // Same story as the video: 28 normal days, then the same point hot two days in a row.
    await setNames(p);
    await p.goto(`${APP}/settings?nosplash=1`);
    await p.locator('select').filter({ has: p.locator('option[value="twodays"]') }).selectOption('twodays');
    await p.getByTestId('sim-load-days').click();
    await p.goto(`${APP}/home?nosplash=1`);
    await p.getByTestId('today-hero').waitFor();
    await shot(p, 'patient-home');
    await p.goto(`${APP}/quick?nosplash=1`);
    await shot(p, 'quick-check');
    await p.goto(`${APP}/history?nosplash=1`);
    await p.locator('svg').first().waitFor();
    await shot(p, 'history', { settle: 1200 });
    for (const [path, name] of [
      ['photo', 'photo'],
      ['tips', 'tips'],
      ['more', 'more'],
      ['settings', 'settings'],
      ['booking', 'booking'],
      ['device', 'device'],
      ['coming-soon', 'coming-soon'],
    ]) {
      await p.goto(`${APP}/${path}?nosplash=1`);
      await shot(p, name, { settle: 900 });
    }
    await p.goto(`${APP}/assistant?nosplash=1`);
    await p.getByTestId('chat').locator('li').first().waitFor();
    await shot(p, 'rafiq', { settle: 1200 });
    await p.getByRole('textbox').fill('رجلي متورمة وفيها شي ينز');
    await p.getByRole('button', { name: 'أرسل' }).click();
    await p.getByTestId('chat').locator('li').last().filter({ hasText: 'العيادة' }).waitFor({ timeout: 20_000 });
    await shot(p, 'rafiq-red', { settle: 1500 });
    await p.goto(`${APP}/report?nosplash=1`);
    await p.getByTestId('report-summary-btn').click();
    await p.getByTestId('report-summary-text').waitFor({ timeout: 30_000 });
    await p.evaluate(() => {
      const sum = document.querySelector('[data-testid=report-summary]').getBoundingClientRect();
      const qr = document.querySelector('[data-testid=report-qr]').getBoundingClientRect();
      scrollBy(0, Math.max(0, Math.min(sum.bottom - (innerHeight - 16), qr.top - 140)));
    });
    await shot(p, 'report');

    await p.goto(`${APP}/family?as=family&nosplash=1`);
    await p.getByTestId('family-wa').waitFor();
    await shot(p, 'family-home', { settle: 900 });

    await p.goto(`${APP}/clinic?as=clinic&nosplash=1`);
    await p.getByTestId('patient-real').waitFor();
    await shot(p, 'clinic-list');
    await p.getByTestId('patient-real').click();
    await p.getByTestId('priority').waitFor();
    await shot(p, 'clinic-patient', { settle: 1200 });
    await p.goto(`${APP}/clinic/patient/real/report?nosplash=1`);
    await p.getByTestId('report-qr').waitFor();
    await shot(p, 'clinic-report');
    await p.goto(`${APP}/clinic/audit?nosplash=1`);
    await shot(p, 'clinic-audit', { settle: 1200 });
    await p.goto(`${APP}/clinic/lab?nosplash=1`);
    await sleep(4000); // the rule lab computes in a worker
    await shot(p, 'clinic-lab', { settle: 800 });
    await ctx.close();
  }

  // ---------- Scan phases and the two results (demo mode: each scan = one day) ----------
  {
    const { ctx, p } = await phone();
    await p.goto(`${APP}/scan?source=sim&as=patient&demo=1&nosplash=1&simTick=450`);
    await setNames(p);
    await p.goto(`${APP}/scan?nosplash=1&simTick=450`);
    await p.getByTestId('sim-scenario').selectOption('hot');
    await p.getByTestId('sim-start').click();
    await p.evaluate(() => scrollTo(0, 0));
    await p.getByTestId('scan-phase').filter({ hasText: /تحقق|الوقوف/ }).waitFor({ timeout: 10_000 });
    await shot(p, 'scan-standing', { settle: 150 });
    await p.getByRole('progressbar').waitFor();
    await p.waitForFunction(() => Number(document.querySelector('[role=progressbar]')?.getAttribute('aria-valuenow')) >= 40, null, {
      timeout: 60_000,
    });
    await shot(p, 'scan-measuring', { settle: 50 });
    await p.getByTestId('scan-done').waitFor({ timeout: 60_000 });
    await shot(p, 'scan-done', { settle: 100 });
    await p.waitForURL(/\/result/);
    await shot(p, 'result-yellow');
    await p.goto(`${APP}/scan?nosplash=1&simTick=60`);
    await p.getByTestId('sim-scenario').selectOption('hot');
    await p.getByTestId('sim-start').click();
    await p.waitForURL(/\/result/, { timeout: 60_000 });
    await shot(p, 'result-orange');
    await ctx.close();
  }

  // ---------- The guided tour, every step ----------
  {
    const { ctx, p } = await phone();
    await p.goto(`${APP}/home?source=sim&as=patient&nosplash=1`);
    await p.getByTestId('tour-start').click();
    const ids = ['scan1', 'day1', 'scan2', 'day2', 'family-alert', 'family', 'rafiq', 'clinic', 'report'];
    for (let i = 0; i < ids.length; i++) {
      await p.locator(`[data-testid=tour-card][data-step="${ids[i]}"]`).waitFor({ timeout: 30_000 });
      if (ids[i].startsWith('scan')) await p.getByRole('progressbar').waitFor();
      // Rafiq step: the tour sends the sentence itself; shoot once the red reply is there.
      if (ids[i] === 'rafiq')
        await p.getByTestId('chat').locator('li').last().filter({ hasText: 'علامة نحتاج العيادة' }).waitFor({ timeout: 20_000 });
      await shot(p, `tour-${i + 1}`, { settle: ids[i].startsWith('scan') ? 700 : 1300 });
      if (!ids[i].startsWith('scan') && i < ids.length - 1) await p.getByTestId('tour-next').click();
    }
    await ctx.close();
  }
} finally {
  await browser.close();
  const missing = ORDER.filter(([n]) => !taken.has(n)).map(([n]) => n);
  writeFileSync(
    `${OUT}manifest.json`,
    JSON.stringify(
      ORDER.map(([n, ar], i) => ({ file: `${String(i + 1).padStart(2, '0')}-${n}.png`, raw: `${n}.png`, ar })),
      null,
      1,
    ),
  );
  if (missing.length) console.log('MISSING:', missing.join(', '));
}
