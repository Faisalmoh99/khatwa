import { expect, test } from '@playwright/test';
import { checkLayout, go, open, shot, simScan } from './helpers';

test.describe('phase 1: entry flow', () => {
  test('splash on cold start', async ({ page }) => {
    await page.goto('/?source=sim');
    await expect(page.getByTestId('splash')).toBeVisible();
    await shot(page, '10-splash');
    await expect(page.getByTestId('splash')).toBeHidden({ timeout: 5000 });
  });

  test('onboarding → consent → demo login → role → patient home', async ({ page }) => {
    await page.goto('/?source=sim&nosplash=1');
    await expect(page).toHaveURL(/\/welcome/);
    await shot(page, '11-onboarding-1');
    await page.getByTestId('onb-next').click();
    await shot(page, '12-onboarding-2');
    await page.getByTestId('onb-next').click();
    await shot(page, '13-onboarding-3');
    await page.getByTestId('onb-next').click();

    await expect(page).toHaveURL(/\/consent/);
    await expect(page.getByTestId('consent-accept')).toBeDisabled();
    await shot(page, '14-consent', { full: true });
    await page.getByRole('switch', { name: /أوافق على جمع بيانات القياس/ }).click();
    await page.getByRole('switch', { name: /مشاركة التنبيهات مع العائلة/ }).click();
    await page.getByTestId('consent-accept').click();

    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByText('نسخة تجريبية')).toBeVisible();
    await page.getByTestId('login-phone').fill('0551234567');
    await shot(page, '15-login-phone');
    await page.getByTestId('login-next').click();
    await page.getByTestId('login-otp').fill('9999');
    await page.getByTestId('login-verify').click();
    await expect(page.getByRole('alert')).toContainText('غير صحيح');
    await page.getByTestId('login-otp').fill('1234');
    await shot(page, '16-login-otp');
    await page.getByTestId('login-verify').click();

    await expect(page).toHaveURL(/\/role/);
    await shot(page, '17-role');
    await page.getByTestId('role-patient').click();
    await expect(page).toHaveURL(/\/home/);
    await expect(page.getByTestId('today-hero')).toHaveAttribute('data-level', 'none');
  });

  test('onboarding can be skipped', async ({ page }) => {
    await page.goto('/?source=sim&nosplash=1');
    await page.getByTestId('onb-skip').click();
    await expect(page).toHaveURL(/\/consent/);
  });

  test('role screens are protected', async ({ page }) => {
    await page.goto('/result?source=sim&nosplash=1');
    await expect(page).toHaveURL(/\/welcome/);
  });
});

test.describe('phase 1: patient home, scan, result', () => {
  test('home before any reading', async ({ page }) => {
    await go(page, '/home');
    await expect(page.getByTestId('device-chip')).toContainText('متصلة');
    await expect(page.getByTestId('ladder-text')).toContainText('ابدأ أول قياس');
    await checkLayout(page);
    await shot(page, '20-home-empty', { full: true });
  });

  test('hot day 1 = yellow, hot day 2 = orange (demo mode), with the reason in plain words', async ({
    page,
  }) => {
    await go(page, '/scan', { demo: true });
    await expect(page.getByTestId('scan-steps')).toBeVisible();
    await shot(page, '21-scan-idle');
    await simScan(page, 'hot');
    await expect(page.getByRole('progressbar')).toBeVisible();
    await shot(page, '22-scan-measuring');
    await expect(page).toHaveURL(/\/result/, { timeout: 15_000 });
    await expect(page.getByTestId('result-hero')).toHaveAttribute('data-level', 'yellow');
    await expect(page.getByTestId('result-reasons')).toContainText('رأس المشط الأول');
    await expect(page.getByTestId('result-reasons')).toContainText('اليوم فقط');
    await checkLayout(page);
    await shot(page, '23-result-yellow', { full: true });

    await open(page, '/scan');
    await simScan(page, 'hot');
    await expect(page).toHaveURL(/\/result/, { timeout: 15_000 });
    await expect(page.getByTestId('result-hero')).toHaveAttribute('data-level', 'orange');
    await expect(page.getByTestId('result-reasons')).toContainText('ليومين متتاليين');
    await expect(page.getByTestId('result-next')).toContainText('خفّف المشي');
    await shot(page, '24-result-orange', { full: true });

    await open(page, '/home');
    await expect(page.getByTestId('today-hero')).toHaveAttribute('data-level', 'orange');
    await checkLayout(page);
    await shot(page, '25-home-orange', { full: true });
  });

  for (const [scn, code, name] of [
    ['one', 'one_foot', '26-scan-one-foot'],
    ['move', 'movement', '27-scan-movement'],
    ['wet', 'low_temp', '28-scan-wet'],
    ['fault', 'fault', '29-scan-fault'],
  ] as const) {
    test(`quality message: ${scn}`, async ({ page }) => {
      await go(page, '/scan');
      await simScan(page, scn);
      await expect(page.getByTestId(`q-${code}`)).toBeVisible({ timeout: 15_000 });
      await shot(page, name);
    });
  }

  test('quality message: whole-foot difference is rejected on the scan screen with a retry', async ({
    page,
  }) => {
    await go(page, '/scan');
    await simScan(page, 'allsites');
    await expect(page.getByTestId('q-allsites')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('scan-phase')).toHaveText('ما انحسبت القراءة');
    await shot(page, '30-scan-allsites');
    await page.getByTestId('scan-retry').click();
    await expect(page.getByTestId('q-allsites')).toBeHidden();
  });

  test('a faulty sensor still produces a result', async ({ page }) => {
    await go(page, '/scan');
    await simScan(page, 'fault');
    await expect(page).toHaveURL(/\/result/, { timeout: 15_000 });
    await expect(page.getByTestId('result-hero')).toHaveAttribute('data-level', 'green');
    await expect(page.getByTestId('result-coverage')).toHaveText(
      'قسنا 7 من 8 نقاط. حساس رأس المشط الخامس، القدم اليسرى معطّل.',
    );
    await shot(page, '29b-result-fault', { full: true });
  });
});

test.describe('phase 1: quick check, WhatsApp, device, settings', () => {
  test('quick check: wound = red, written as a quickcheck event', async ({ page }) => {
    await go(page, '/quick');
    await shot(page, '31-quick-1');
    await page.getByTestId('quick-skin-wound').click();
    await page.getByTestId('quick-pain-ok').click();
    await page.getByTestId('quick-care-done').click();
    await expect(page.getByTestId('quick-result')).toHaveAttribute('data-level', 'red');
    await shot(page, '32-quick-red', { full: true });
    const events = await page.evaluate(
      () => JSON.parse(localStorage.getItem('kh.sim.khatwa-01') || '{}').events,
    );
    expect(events.filter((e: { kind: string }) => e.kind === 'quickcheck')).toEqual([
      expect.objectContaining({ kind: 'quickcheck', data: { skin: 'wound', pain: 'ok', care: 'done' } }),
    ]);
    await open(page, '/home');
    await expect(page.getByTestId('today-hero')).toHaveAttribute('data-level', 'red');
  });

  test('quick check: all fine = green and counts as measured today', async ({ page }) => {
    await go(page, '/quick');
    await page.getByTestId('quick-skin-ok').click();
    await page.getByTestId('quick-pain-ok').click();
    await page.getByTestId('quick-care-done').click();
    await expect(page.getByTestId('quick-result')).toHaveAttribute('data-level', 'green');
    await open(page, '/home');
    // Quick check only: counts for today, but it is not a scan (no "قست اليوم. ممتاز.").
    await expect(page.getByTestId('ladder-text')).toHaveText('سوّيت الفحص السريع اليوم.');
  });

  test('WhatsApp button opens wa.me with a ready message to the saved family number', async ({ page }) => {
    await go(page, '/settings', { demo: true });
    await page.getByTestId('family-phone').fill('0551234567');
    await open(page, '/scan');
    await simScan(page, 'hot');
    await expect(page).toHaveURL(/\/result/, { timeout: 15_000 });
    const href = await page.getByTestId('wa-family').getAttribute('href');
    expect(href).toMatch(/^https:\/\/wa\.me\/966551234567\?text=/);
    const text = decodeURIComponent(href!.split('text=')[1]!);
    expect(text).toContain('أصفر');
    expect(text).toContain('رأس المشط الأول');
    expect(text).toContain('مو تشخيص');
  });

  test('device screen: online, then offline when the heartbeat stops', async ({ page }) => {
    await go(page, '/device');
    await expect(page.getByTestId('device-online')).toHaveText('السجادة متصلة');
    await checkLayout(page);
    await shot(page, '33-device', { full: true });
    await page.getByRole('switch', { name: 'الجهاز الافتراضي شغّال' }).click();
    await expect(page.getByTestId('device-online')).toHaveText('السجادة غير متصلة');
  });

  test('settings and more', async ({ page }) => {
    await go(page, '/settings');
    await checkLayout(page);
    await shot(page, '34-settings', { full: true });
    await open(page, '/more');
    await checkLayout(page);
    await shot(page, '35-more');
  });

  test('30-day history: home shows the week and the ladder', async ({ page }) => {
    await go(page, '/settings');
    await page.getByTestId('sim-load-days').click();
    await open(page, '/home');
    await expect(page.getByTestId('streak')).not.toHaveText('ابدأ اليوم');
    await shot(page, '36-home-30days', { full: true });
  });
});
