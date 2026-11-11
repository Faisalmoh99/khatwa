import { expect, test } from '@playwright/test';
import { checkLayout, go, open, shot } from './helpers';

/** Filter 2 demo build: simulation by default, write switch, guided tour, Wokwi source. */

const SIM_BANNER = 'نسخة عرض: بيانات محاكاة. الجهاز المادي يُبنى للنهائيات';

test('first visit: simulation by default with the 30-day "developing" history, banner on every screen', async ({
  page,
}) => {
  await page.goto('/?nosplash=1');
  await expect(page).toHaveURL(/\/welcome/);
  await expect(page.getByTestId('source-banner')).toHaveText(SIM_BANNER);
  await shot(page, 'd1-welcome-banner');

  // Through the normal entry (no source in the link): lands on a preloaded simulation.
  await page.goto('/home?nosplash=1&as=patient');
  await expect(page.getByTestId('source-banner')).toHaveText(SIM_BANNER);
  // "developing": the right first metatarsal heats from day 8, so today is orange (simulated history).
  await expect(page.getByTestId('today-hero')).toHaveAttribute('data-level', 'orange');
  await expect(page.getByTestId('tour-offer')).toBeVisible();
  await checkLayout(page);
  await shot(page, 'd2-home-first-visit', { full: true });

  // The preload happens once: a reload does not reload the history (still 30 days, same level).
  await page.reload();
  await expect(page.getByTestId('today-hero')).toHaveAttribute('data-level', 'orange');
  const n = await page.evaluate(() => JSON.parse(localStorage.getItem('kh.sim.khatwa-01')!).scans.length);
  expect(n).toBe(30);
});

test('an explicit ?source= link gets no preloaded history (tests and demo links stay clean)', async ({
  page,
}) => {
  await go(page, '/home');
  await expect(page.getByTestId('today-hero')).toHaveAttribute('data-level', 'none');
});

test('«هذا جوال المريض» is off by default: the real mat is read-only and says so', async ({ page }) => {
  await page.goto('/quick?source=firebase&as=patient&nosplash=1&dev=khatwa-e2e');
  await expect(page.getByTestId('source-banner')).toContainText('مشاهدة فقط');
  await page.getByTestId('quick-skin-wound').click();
  await page.getByTestId('quick-pain-ok').click();
  await page.getByTestId('quick-care-done').click();
  await expect(page.getByText(/للمشاهدة فقط: ما نحفظ شي من هذا الجوال/)).toBeVisible();
  await expect(page.getByTestId('quick-result')).toHaveCount(0);

  await open(page, '/settings');
  const sw = page.getByTestId('patient-device');
  await expect(sw).toHaveAttribute('aria-checked', 'false');
  await sw.click();
  await expect(sw).toHaveAttribute('aria-checked', 'true');
  // Patient phone on the real mat: no banner at all.
  await expect(page.getByTestId('source-banner')).toHaveCount(0);
  await shot(page, 'd3-settings-patient-device', { full: true });
});

test('Wokwi source reads devices/khatwa-demo, shows its banner, and never writes', async ({ page }) => {
  await go(page, '/settings');
  await page.getByRole('radio', { name: /السجادة الافتراضية \(Wokwi\)/ }).click();
  await expect(page.getByTestId('source-banner')).toHaveText('متصل بالسجادة الافتراضية (Wokwi)');
  // The switch does not open writes for Wokwi.
  await page.getByTestId('patient-device').click();
  await open(page, '/device');
  await expect(page.getByTestId('device-id')).toHaveText('السجادة الافتراضية (Wokwi)');
  await open(page, '/quick');
  await page.getByTestId('quick-skin-wound').click();
  await page.getByTestId('quick-pain-ok').click();
  await page.getByTestId('quick-care-done').click();
  await expect(page.getByText(/للمشاهدة فقط/)).toBeVisible();
});

test('the assistant is called «رفيق»', async ({ page }) => {
  await go(page, '/assistant');
  await expect(page.getByRole('heading', { name: 'رفيق' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'رفيق' })).toBeVisible();
});

test('«جرّب السيناريو»: scan, day 1 yellow, day 2 orange, family, Rafiq red, clinic, report; then restores', async ({
  page,
}) => {
  test.setTimeout(90_000);
  await go(page, '/home');
  await page.getByTestId('tour-start').click();
  const card = page.getByTestId('tour-card');
  const next = page.getByTestId('tour-next');

  await expect(card).toHaveAttribute('data-step', 'scan1');
  await expect(page).toHaveURL(/\/scan/);
  await expect(page.getByRole('progressbar')).toBeVisible();
  await shot(page, 'd4-tour-1-scan');

  await expect(card).toHaveAttribute('data-step', 'day1', { timeout: 20_000 });
  await expect(page.getByTestId('result-hero')).toHaveAttribute('data-level', 'yellow');
  await shot(page, 'd4-tour-2-day1');
  await next.click();

  await expect(card).toHaveAttribute('data-step', 'day2', { timeout: 20_000 });
  await expect(page.getByTestId('result-hero')).toHaveAttribute('data-level', 'orange');
  await expect(page.getByTestId('result-reasons')).toContainText('رأس المشط الأول');
  await shot(page, 'd4-tour-3-day2');
  await next.click();

  await expect(card).toHaveAttribute('data-step', 'family-alert');
  await expect(page.getByTestId('wa-family')).toBeVisible();
  await shot(page, 'd4-tour-4-whatsapp');
  await next.click();

  await expect(card).toHaveAttribute('data-step', 'family');
  await expect(page).toHaveURL(/\/family/);
  await expect(page.getByTestId('family-wa')).toBeVisible();
  await shot(page, 'd4-tour-5-family');
  await next.click();

  await expect(card).toHaveAttribute('data-step', 'rafiq');
  await expect(page).toHaveURL(/\/assistant/);
  const input = page.getByRole('textbox');
  await expect(input).toHaveValue('رجلي متورمة وفيها شي ينز');
  await page.getByRole('button', { name: /أرسل/ }).click();
  await expect(page.getByTestId('chat')).toContainText(/العيادة/);
  await shot(page, 'd4-tour-6-rafiq');
  await next.click();

  await expect(card).toHaveAttribute('data-step', 'clinic');
  await expect(page).toHaveURL(/\/clinic$/);
  await expect(page.getByTestId('patient-real')).toHaveAttribute('data-level', 'red');
  await shot(page, 'd4-tour-7-clinic');
  await next.click();

  await expect(card).toHaveAttribute('data-step', 'report');
  await expect(page.getByTestId('report-qr')).toBeVisible();
  await expect(page.getByTestId('report-sim')).toBeVisible();
  await checkLayout(page);
  await shot(page, 'd4-tour-8-report');
  await next.click();

  // Back where the visitor was: their own simulation, demo mode off, patient role.
  await expect(card).toHaveCount(0);
  await expect(page).toHaveURL(/\/home/);
  const st = await page.evaluate(() => JSON.parse(localStorage.getItem('kh.settings')!).state);
  expect(st).toMatchObject({
    dataSource: 'simulation',
    deviceId: 'khatwa-01',
    demoMode: false,
    role: 'patient',
  });
  expect(await page.evaluate(() => localStorage.getItem('kh.sim.khatwa-tour'))).toBeNull();
});

test('the tour also starts from the welcome screen without signing up, and returns there', async ({
  page,
}) => {
  await page.goto('/?nosplash=1&simTick=40');
  await page.getByTestId('onb-tour').click();
  await expect(page.getByTestId('tour-card')).toHaveAttribute('data-step', 'scan1');
  await page.getByTestId('tour-exit').click();
  await expect(page).toHaveURL(/\/welcome/);
});

test('honesty: build status sentence on welcome, device and about; the simulator is never called the mat', async ({
  page,
}) => {
  const SENTENCE = 'مصمم لـ 4 حساسات حرارة لكل قدم + ضغط الكعب. الجهاز المادي يُبنى للنهائيات';
  await page.goto('/?nosplash=1');
  await expect(page.getByText(SENTENCE)).toBeVisible();
  await go(page, '/device');
  await expect(page.getByTestId('build-status')).toContainText(SENTENCE);
  await expect(page.getByTestId('device-online')).toHaveText('المحاكي شغّال');
  await open(page, '/settings');
  await expect(page.getByTestId('about-build-status')).toContainText(SENTENCE);
});

test('the source banner stays on screen while scrolling, with the top bar under it', async ({ page }) => {
  await go(page, '/settings');
  await page.mouse.wheel(0, 4000);
  await page.waitForTimeout(300);
  const banner = await page.getByTestId('banners').boundingBox();
  const header = await page.locator('header').first().boundingBox();
  expect(banner!.y).toBe(0);
  expect(Math.round(header!.y)).toBe(Math.round(banner!.height));
  await expect(page.getByTestId('source-banner')).toBeInViewport();
});

test('report on simulated data says «جهاز محاكاة», never a device id', async ({ page }) => {
  await go(page, '/report');
  await expect(page.getByTestId('report-device')).toHaveText('جهاز محاكاة');
  await expect(page.getByTestId('report')).not.toContainText('khatwa-01');
});

test('Rafiq: the red reply ends up above the input bar, fully visible', async ({ page }) => {
  await go(page, '/assistant');
  await page.getByRole('textbox').fill('رجلي متورمة وفيها شي ينز');
  await page.getByRole('button', { name: 'أرسل' }).click();
  const last = page.getByTestId('chat').locator('li').last();
  await expect(last).toContainText('العيادة');
  await page.waitForTimeout(1200); // smooth scroll
  const msg = (await last.boundingBox())!;
  const bar = (await page.getByRole('textbox').boundingBox())!;
  const replies = await page.getByTestId('quick-replies').boundingBox();
  const barTop = Math.min(bar.y, replies?.y ?? bar.y);
  expect(msg.y).toBeGreaterThanOrEqual(0);
  expect(msg.y + msg.height).toBeLessThanOrEqual(barTop);
});

test('bottom navigation is opaque (page text never shows through it)', async ({ page }) => {
  await go(page, '/home');
  const bg = await page
    .locator('nav')
    .last()
    .evaluate((e) => getComputedStyle(e).backgroundColor);
  expect(bg).toMatch(/^rgb\(/); // rgb(...) = no alpha; rgba(..., 0.95) was see-through
});

test('simulated data: «أبو سعد» as the patient name, «جهاز محاكاة» on the device screen, no device id', async ({
  page,
}) => {
  await go(page, '/device');
  await expect(page.getByTestId('device-id')).toHaveText('جهاز محاكاة');
  await expect(page.getByText('khatwa-01')).toHaveCount(0);
  await open(page, '/clinic?as=clinic');
  await expect(page.getByTestId('patient-real')).toContainText('أبو سعد');
  await expect(page.getByText('مريض خطوة 01')).toHaveCount(0);
});
